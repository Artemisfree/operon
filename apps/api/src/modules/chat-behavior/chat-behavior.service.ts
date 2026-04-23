import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentBehaviorVersionStatus,
  Prisma,
} from '@prisma/client';

import { serializeValue } from '../../common/serialization.js';
import { PrismaService } from '../db/prisma.service.js';
import { compileBehaviorPrompt } from './chat-behavior.compiler.js';
import {
  createBehaviorDefinitionFromTemplate,
  createDefaultBehaviorDefinition,
} from './chat-behavior.defaults.js';
import type {
  BehaviorDefinition,
  CreateBehaviorProfileInput,
  PreviewBehaviorInput,
  UpdateBehaviorDraftInput,
} from './chat-behavior.schemas.js';

@Injectable()
export class ChatBehaviorService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listProfiles() {
    await this.ensureDefaultProfile();

    const profiles = await this.prisma.agentBehaviorProfile.findMany({
      include: {
        versions: {
          where: {
            status: {
              in: [
                AgentBehaviorVersionStatus.draft,
                AgentBehaviorVersionStatus.published,
              ],
            },
          },
          orderBy: { version: 'desc' },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    return profiles.map((profile) => {
      const published = profile.versions.find(
        (version) => version.status === AgentBehaviorVersionStatus.published,
      );
      const draft = profile.versions.find(
        (version) => version.status === AgentBehaviorVersionStatus.draft,
      );

      return serializeValue({
        id: profile.id,
        name: profile.name,
        code: profile.code,
        description: profile.description,
        isDefault: profile.isDefault,
        updatedAt: profile.updatedAt,
        publishedVersion: published
          ? { id: published.id, version: published.version, publishedAt: published.publishedAt }
          : null,
        draftVersion: draft ? { id: draft.id, version: draft.version } : null,
      });
    });
  }

  async getProfile(profileId: string) {
    await this.ensureDefaultProfile();
    const profile = await this.prisma.agentBehaviorProfile.findUnique({
      where: { id: profileId },
      include: {
        versions: {
          orderBy: [{ version: 'desc' }],
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Behavior profile ${profileId} not found`);
    }

    const draft = profile.versions.find(
      (version) => version.status === AgentBehaviorVersionStatus.draft,
    );
    const published = profile.versions.find(
      (version) => version.status === AgentBehaviorVersionStatus.published,
    );

    if (!draft) {
      throw new NotFoundException(`Draft version for profile ${profileId} not found`);
    }

    const preview = compileBehaviorPrompt(draft.definition as unknown as BehaviorDefinition);

    return serializeValue({
      id: profile.id,
      name: profile.name,
      code: profile.code,
      description: profile.description,
      isDefault: profile.isDefault,
      draft: {
        id: draft.id,
        version: draft.version,
        definition: draft.definition,
        compiledPrompt: draft.compiledPrompt,
      },
      published: published
        ? {
            id: published.id,
            version: published.version,
            definition: published.definition,
            compiledPrompt: published.compiledPrompt,
            publishedAt: published.publishedAt,
          }
        : null,
      preview,
    });
  }

  async createProfile(input: CreateBehaviorProfileInput, adminEmail: string) {
    const definition = createBehaviorDefinitionFromTemplate(
      input.templateId ?? 'default',
      input.name,
    );
    const preview = compileBehaviorPrompt(definition);
    const code = await this.generateUniqueCode(input.name);

    const created = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.agentBehaviorProfile.create({
        data: {
          name: input.name,
          code,
          description: input.description,
          isDefault: false,
        },
      });

      await tx.agentBehaviorVersion.create({
        data: {
          profileId: profile.id,
          version: 1,
          status: AgentBehaviorVersionStatus.published,
          definition: definition as Prisma.InputJsonValue,
          compiledPrompt: preview.compiledPrompt,
          createdBy: adminEmail,
          publishedAt: new Date(),
        },
      });

      await tx.agentBehaviorVersion.create({
        data: {
          profileId: profile.id,
          version: 2,
          status: AgentBehaviorVersionStatus.draft,
          definition: definition as Prisma.InputJsonValue,
          compiledPrompt: preview.compiledPrompt,
          createdBy: adminEmail,
        },
      });

      return profile;
    });

    return this.getProfile(created.id);
  }

  async updateDraft(
    profileId: string,
    input: UpdateBehaviorDraftInput,
    adminEmail: string,
  ) {
    const profile = await this.findProfileWithVersions(profileId);
    const draft = this.requireDraft(profile.versions, profileId);
    const nextName = input.name ?? profile.name;
    const nextDefinition = {
      ...input.definition,
      profileMeta: {
        ...input.definition.profileMeta,
        name: nextName,
      },
    };

    const preview = compileBehaviorPrompt(nextDefinition);

    await this.prisma.$transaction([
      this.prisma.agentBehaviorProfile.update({
        where: { id: profileId },
        data: {
          name: nextName,
          description:
            input.description === undefined ? profile.description : input.description,
        },
      }),
      this.prisma.agentBehaviorVersion.update({
        where: { id: draft.id },
        data: {
          definition: nextDefinition as Prisma.InputJsonValue,
          compiledPrompt: preview.compiledPrompt,
          createdBy: adminEmail,
        },
      }),
    ]);

    return this.getProfile(profileId);
  }

  async preview(input: PreviewBehaviorInput) {
    return compileBehaviorPrompt(input.definition);
  }

  async publish(profileId: string, adminEmail: string) {
    const profile = await this.findProfileWithVersions(profileId);
    const draft = this.requireDraft(profile.versions, profileId);
    const preview = compileBehaviorPrompt(draft.definition as unknown as BehaviorDefinition);

    if (preview.errors.length > 0) {
      throw new BadRequestException({
        message: 'Behavior profile validation failed',
        issues: preview.errors.map((message) => ({ message })),
      });
    }

    const published = profile.versions.find(
      (version) => version.status === AgentBehaviorVersionStatus.published,
    );

    await this.prisma.$transaction(async (tx) => {
      if (published) {
        await tx.agentBehaviorVersion.update({
          where: { id: published.id },
          data: { status: AgentBehaviorVersionStatus.archived },
        });
      }

      await tx.agentBehaviorVersion.update({
        where: { id: draft.id },
        data: {
          status: AgentBehaviorVersionStatus.published,
          compiledPrompt: preview.compiledPrompt,
          publishedAt: new Date(),
          createdBy: adminEmail,
        },
      });

      await tx.agentBehaviorVersion.create({
        data: {
          profileId,
          version: draft.version + 1,
          status: AgentBehaviorVersionStatus.draft,
          definition: draft.definition as Prisma.InputJsonValue,
          compiledPrompt: preview.compiledPrompt,
          createdBy: adminEmail,
        },
      });
    });

    return this.getProfile(profileId);
  }

  async listVersions(profileId: string) {
    const profile = await this.findProfileWithVersions(profileId);

    return serializeValue(
      profile.versions.map((version) => ({
        id: version.id,
        version: version.version,
        status: version.status,
        createdBy: version.createdBy,
        publishedAt: version.publishedAt,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
      })),
    );
  }

  async resolveBehaviorPrompt(versionId?: string | null) {
    await this.ensureDefaultProfile();

    if (versionId) {
      const version = await this.prisma.agentBehaviorVersion.findUnique({
        where: { id: versionId },
      });

      if (version) {
        return {
          behaviorVersionId: version.id,
          compiledPrompt: version.compiledPrompt,
        };
      }
    }

    const published = await this.prisma.agentBehaviorVersion.findFirstOrThrow({
      where: {
        status: AgentBehaviorVersionStatus.published,
        profile: { isDefault: true },
      },
      orderBy: { version: 'desc' },
    });

    return {
      behaviorVersionId: published.id,
      compiledPrompt: published.compiledPrompt,
    };
  }

  async getDefaultPublishedBehaviorVersionId() {
    const resolved = await this.resolveBehaviorPrompt();
    return resolved.behaviorVersionId;
  }

  private async ensureDefaultProfile() {
    const existingDefault = await this.prisma.agentBehaviorProfile.findFirst({
      where: { isDefault: true },
      include: { versions: true },
    });

    if (existingDefault) {
      const hasPublished = existingDefault.versions.some(
        (version) => version.status === AgentBehaviorVersionStatus.published,
      );
      const hasDraft = existingDefault.versions.some(
        (version) => version.status === AgentBehaviorVersionStatus.draft,
      );

      if (hasPublished && hasDraft) {
        return existingDefault;
      }
    }

    const definition = createDefaultBehaviorDefinition('Основной');
    const preview = compileBehaviorPrompt(definition);

    return this.prisma.$transaction(async (tx) => {
      const profile =
        existingDefault ??
        (await tx.agentBehaviorProfile.create({
          data: {
            name: 'Основной',
            code: 'default',
            description: 'Базовый профиль поведения AI-агента.',
            isDefault: true,
          },
          include: { versions: true },
        }));

      const versions = await tx.agentBehaviorVersion.findMany({
        where: { profileId: profile.id },
      });
      const latestVersion = versions.reduce(
        (max, version) => Math.max(max, version.version),
        0,
      );

      const hasPublished = versions.some(
        (version) => version.status === AgentBehaviorVersionStatus.published,
      );
      const hasDraft = versions.some(
        (version) => version.status === AgentBehaviorVersionStatus.draft,
      );

      if (!hasPublished) {
        await tx.agentBehaviorVersion.create({
          data: {
            profileId: profile.id,
            version: latestVersion + 1,
            status: AgentBehaviorVersionStatus.published,
            definition: definition as Prisma.InputJsonValue,
            compiledPrompt: preview.compiledPrompt,
            createdBy: 'system',
            publishedAt: new Date(),
          },
        });
      }

      if (!hasDraft) {
        await tx.agentBehaviorVersion.create({
          data: {
            profileId: profile.id,
            version: latestVersion + (hasPublished ? 1 : 2),
            status: AgentBehaviorVersionStatus.draft,
            definition: definition as Prisma.InputJsonValue,
            compiledPrompt: preview.compiledPrompt,
            createdBy: 'system',
          },
        });
      }

      return profile;
    });
  }

  private async generateUniqueCode(name: string) {
    const transliterated = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');

    const base = (transliterated || 'behavior-profile').slice(0, 48);
    let candidate = base;
    let index = 1;

    while (
      await this.prisma.agentBehaviorProfile.findUnique({
        where: { code: candidate },
      })
    ) {
      index += 1;
      candidate = `${base}-${index}`;
    }

    return candidate;
  }

  private async findProfileWithVersions(profileId: string) {
    const profile = await this.prisma.agentBehaviorProfile.findUnique({
      where: { id: profileId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Behavior profile ${profileId} not found`);
    }

    return profile;
  }

  private requireDraft(
    versions: Array<{
      id: string;
      status: AgentBehaviorVersionStatus;
      version: number;
      definition: Prisma.JsonValue;
    }>,
    profileId: string,
  ) {
    const draft = versions.find(
      (version) => version.status === AgentBehaviorVersionStatus.draft,
    );

    if (!draft) {
      throw new NotFoundException(`Draft version for profile ${profileId} not found`);
    }

    return draft;
  }
}
