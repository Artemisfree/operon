import { useEffect, useMemo, useState } from 'react';

import {
  addBlockToStage,
  findBlock,
  moveBlock,
  removeBlock,
  toggleStage,
  updateBlock,
} from './behaviorBuilder';
import {
  BLOCK_LABELS,
  STAGE_BLOCK_TYPES,
  STAGE_LABELS,
} from './behaviorBlocks';
import {
  createBehaviorProfile,
  getBehaviorProfile,
  listBehaviorProfiles,
  listBehaviorVersions,
  previewBehaviorDraft,
  publishBehaviorProfile,
  saveBehaviorDraft,
} from './behaviorApi';
import type {
  BehaviorBlockDefinition,
  BehaviorDefinition,
  BehaviorProfileDetail,
  BehaviorProfileListItem,
  BehaviorPreview,
  BehaviorStageId,
  BehaviorVersionRecord,
} from './behaviorTypes';
import { BEHAVIOR_STAGE_ORDER } from './behaviorTypes';

type Props = {
  token: string;
  onOpenChats: () => void;
  onOpenOrders: () => void;
  onOpenMetrics: () => void;
  onLogout: () => void;
};

const FIELD_OPTIONS = [
  { value: 'customerName', label: 'Имя' },
  { value: 'customerPhone', label: 'Телефон' },
  { value: 'deliveryAddress', label: 'Адрес доставки' },
  { value: 'comment', label: 'Комментарий' },
] as const;

const SUMMARY_FIELD_OPTIONS = [
  { value: 'items', label: 'Состав заказа' },
  { value: 'customerPhone', label: 'Телефон' },
  { value: 'deliveryAddress', label: 'Адрес' },
  { value: 'customerName', label: 'Имя' },
  { value: 'comment', label: 'Комментарий' },
] as const;

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('ru-RU');
}

function cloneDefinition(definition: BehaviorDefinition) {
  return JSON.parse(JSON.stringify(definition)) as BehaviorDefinition;
}

export function BehaviorView({
  token,
  onOpenChats,
  onOpenOrders,
  onOpenMetrics,
  onLogout,
}: Props) {
  const [profiles, setProfiles] = useState<BehaviorProfileListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BehaviorProfileDetail | null>(null);
  const [draft, setDraft] = useState<BehaviorDefinition | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [selectedStageId, setSelectedStageId] = useState<BehaviorStageId>(
    BEHAVIOR_STAGE_ORDER[0],
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [preview, setPreview] = useState<BehaviorPreview | null>(null);
  const [versions, setVersions] = useState<BehaviorVersionRecord[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileTemplate, setNewProfileTemplate] = useState<
    'default' | 'concise' | 'handoff-first'
  >('default');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dirty, setDirty] = useState(false);

  const selectedBlockInfo = useMemo(
    () => (draft ? findBlock(draft, selectedBlockId) : null),
    [draft, selectedBlockId],
  );

  const reloadProfiles = async () => {
    const items = await listBehaviorProfiles(token);
    setProfiles(items);
    if (!selectedId && items[0]) {
      setSelectedId(items[0].id);
    }
  };

  useEffect(() => {
    void reloadProfiles().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить профили.');
    });
  }, []);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const nextDetail = await getBehaviorProfile(token, selectedId);
        if (cancelled) {
          return;
        }

        setDetail(nextDetail);
        setDraft(cloneDefinition(nextDetail.draft.definition));
        setProfileName(nextDetail.name);
        setProfileDescription(nextDetail.description ?? '');
        setPreview(nextDetail.preview);
        setError(null);

        const firstBlockId =
          nextDetail.draft.definition.stages
            .find((stage) => stage.blocks.length > 0)
            ?.blocks.sort((left, right) => left.order - right.order)[0]?.id ?? null;

        setSelectedStageId(
          nextDetail.draft.definition.stages.find((stage) => stage.blocks.length > 0)
            ?.stageId ?? BEHAVIOR_STAGE_ORDER[0],
        );
        setSelectedBlockId(firstBlockId);
        setDirty(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Не удалось загрузить профиль.',
          );
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [selectedId, token]);

  useEffect(() => {
    if (!selectedId || !draft) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void previewBehaviorDraft(token, selectedId, draft)
        .then((nextPreview) => {
          setPreview(nextPreview);
        })
        .catch((previewError) => {
          setError(
            previewError instanceof Error
              ? previewError.message
              : 'Не удалось собрать preview.',
          );
        });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [draft, selectedId, token]);

  const ensureDraft = () => {
    if (!draft) {
      throw new Error('Draft not loaded');
    }
    return draft;
  };

  const applyDraft = (nextDraft: BehaviorDefinition) => {
    setDraft(nextDraft);
    setDirty(true);
    setError(null);
  };

  const handleSave = async () => {
    if (!selectedId || !draft) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await saveBehaviorDraft(token, selectedId, {
        name: profileName,
        description: profileDescription || null,
        definition: {
          ...draft,
          profileMeta: {
            ...draft.profileMeta,
            name: profileName,
          },
        },
      });
      setDetail(response);
      setDraft(cloneDefinition(response.draft.definition));
      setPreview(response.preview);
      setDirty(false);
      await reloadProfiles();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Не удалось сохранить черновик.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedId) {
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const response = await publishBehaviorProfile(token, selectedId);
      setDetail(response);
      setDraft(cloneDefinition(response.draft.definition));
      setPreview(response.preview);
      setDirty(false);
      await reloadProfiles();
      if (showVersions) {
        setVersions(await listBehaviorVersions(token, selectedId));
      }
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'Не удалось опубликовать профиль.',
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      setError('Для создания профиля нужно название.');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const created = await createBehaviorProfile(token, {
        name: newProfileName.trim(),
        templateId: newProfileTemplate,
      });
      setNewProfileName('');
      setNewProfileTemplate('default');
      await reloadProfiles();
      setSelectedId(created.id);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Не удалось создать профиль.',
      );
    } finally {
      setCreating(false);
    }
  };

  const handleLoadVersions = async () => {
    if (!selectedId) {
      return;
    }

    setShowVersions((current) => !current);
    if (!showVersions) {
      try {
        setVersions(await listBehaviorVersions(token, selectedId));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить версии.',
        );
      }
    }
  };

  const selectedBlock = selectedBlockInfo?.block ?? null;

  return (
    <>
      <aside className="admin-sidebar admin-behavior-sidebar">
        <header className="admin-sidebar-header admin-behavior-sidebar-header">
          <div>
            <p className="admin-eyebrow">Operon</p>
            <h1>Поведение AI</h1>
            <p className="admin-muted admin-behavior-sidebar-subtitle">
              Профили и шаблоны
            </p>
          </div>
          <div className="admin-header-actions">
            <button type="button" onClick={onOpenChats}>
              Диалоги
            </button>
            <button type="button" onClick={onOpenOrders}>
              Заказы
            </button>
            <button type="button" onClick={onOpenMetrics}>
              Метрики
            </button>
            <button type="button" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </header>

        <div className="admin-behavior-sidebar-content">
          <div className="admin-behavior-create">
            <div className="admin-behavior-section-head">
              <h2>Новый профиль</h2>
              <p className="admin-muted">
                Создай сценарий из готового шаблона и дальше настрой блоки.
              </p>
            </div>
            <label>
              <span>Название</span>
              <input
                value={newProfileName}
                onChange={(event) => setNewProfileName(event.target.value)}
                placeholder="Например, VIP"
              />
            </label>
            <label>
              <span>Шаблон</span>
              <select
                value={newProfileTemplate}
                onChange={(event) =>
                  setNewProfileTemplate(
                    event.target.value as 'default' | 'concise' | 'handoff-first',
                  )
                }
              >
                <option value="default">Базовый заказ</option>
                <option value="concise">Короткие ответы</option>
                <option value="handoff-first">С быстрым handoff</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handleCreateProfile()}
              disabled={creating}
            >
              {creating ? 'Создание...' : 'Создать профиль'}
            </button>
          </div>

          <div className="admin-behavior-profile-panel">
            <div className="admin-behavior-section-head">
              <h2>Профили</h2>
              <p className="admin-muted">Выбери сценарий и отредактируй его flow.</p>
            </div>

            <div className="admin-behavior-profile-list">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className={`admin-conversation-item admin-behavior-profile-item ${
                    profile.id === selectedId ? 'admin-conversation-item-active' : ''
                  }`}
                  onClick={() => setSelectedId(profile.id)}
                >
                  <div className="admin-conversation-topline">
                    <strong>{profile.name}</strong>
                    {profile.isDefault ? (
                      <span className="admin-order-status-pill">default</span>
                    ) : null}
                  </div>
                  <p className="admin-order-meta">
                    draft v{profile.draftVersion?.version ?? '—'} · published v
                    {profile.publishedVersion?.version ?? '—'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <section className="admin-main admin-behavior-main">
        <header className="admin-main-header">
          <div>
            <h2>{detail?.name ?? 'Профиль не выбран'}</h2>
            <p className="admin-muted">
              Draft v{detail?.draft.version ?? '—'} · Published v
              {detail?.published?.version ?? '—'}
              {dirty ? ' · есть несохранённые изменения' : ''}
            </p>
          </div>
          <div className="admin-actions admin-order-actions">
            <button type="button" onClick={() => void handleSave()} disabled={!dirty || saving}>
              {saving ? 'Сохранение...' : 'Сохранить draft'}
            </button>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishing || (preview?.errors.length ?? 0) > 0}
            >
              {publishing ? 'Публикация...' : 'Опубликовать'}
            </button>
            <button type="button" onClick={() => void handleLoadVersions()}>
              {showVersions ? 'Скрыть версии' : 'История версий'}
            </button>
          </div>
        </header>

        {draft ? (
          <>
            <div className="admin-behavior-meta">
              <label>
                <span>Название профиля</span>
                <input
                  value={profileName}
                  onChange={(event) => {
                    setProfileName(event.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                <span>Описание</span>
                <input
                  value={profileDescription}
                  onChange={(event) => {
                    setProfileDescription(event.target.value);
                    setDirty(true);
                  }}
                />
              </label>
            </div>

            <div className="admin-behavior-grid">
              <div className="admin-behavior-flow">
                {draft.stages.map((stage) => (
                  <article key={stage.stageId} className="admin-behavior-card">
                    <header className="admin-conversation-topline">
                      <div>
                        <h3>{STAGE_LABELS[stage.stageId]}</h3>
                        <p className="admin-muted">
                          {stage.enabled ? 'Этап включён' : 'Этап выключен'}
                        </p>
                      </div>
                      <label className="admin-behavior-toggle">
                        <input
                          type="checkbox"
                          checked={stage.enabled}
                          onChange={(event) =>
                            applyDraft(toggleStage(ensureDraft(), stage.stageId, event.target.checked))
                          }
                        />
                        <span>Активен</span>
                      </label>
                    </header>

                    <div className="admin-behavior-block-actions">
                      {STAGE_BLOCK_TYPES[stage.stageId].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            const nextDraft = addBlockToStage(ensureDraft(), stage.stageId, type);
                            applyDraft(nextDraft);
                            setSelectedStageId(stage.stageId);
                            const addedBlock =
                              nextDraft.stages
                                .find((entry) => entry.stageId === stage.stageId)
                                ?.blocks.sort((left, right) => right.order - left.order)[0] ?? null;
                            setSelectedBlockId(addedBlock?.id ?? null);
                          }}
                        >
                          + {BLOCK_LABELS[type]}
                        </button>
                      ))}
                    </div>

                    <div className="admin-behavior-stage-list">
                      {stage.blocks
                        .slice()
                        .sort((left, right) => left.order - right.order)
                        .map((block, index, orderedBlocks) => (
                          <article
                            key={block.id}
                            className={`admin-behavior-block-card ${
                              block.id === selectedBlockId ? 'admin-behavior-block-card-active' : ''
                            }`}
                            onClick={() => {
                              setSelectedStageId(stage.stageId);
                              setSelectedBlockId(block.id);
                            }}
                          >
                            <div className="admin-conversation-topline">
                              <strong>{BLOCK_LABELS[block.type]}</strong>
                              <span className="admin-order-status-pill">
                                {block.enabled ? 'on' : 'off'}
                              </span>
                            </div>
                            <div className="admin-behavior-inline-actions">
                              <button
                                type="button"
                                className="admin-behavior-action-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  applyDraft(
                                    updateBlock(ensureDraft(), block.id, (current) => ({
                                      ...current,
                                      enabled: !current.enabled,
                                    })),
                                  );
                                }}
                              >
                                {block.enabled ? 'Выключить' : 'Включить'}
                              </button>
                              <button
                                type="button"
                                className="admin-behavior-action-button"
                                disabled={index === 0}
                                aria-label="Поднять блок выше"
                                title={
                                  index === 0
                                    ? 'Блок уже находится первым'
                                    : 'Поднять блок выше'
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  applyDraft(moveBlock(ensureDraft(), stage.stageId, block.id, 'up'));
                                }}
                              >
                                ↑ Поднять
                              </button>
                              <button
                                type="button"
                                className="admin-behavior-action-button"
                                disabled={index === orderedBlocks.length - 1}
                                aria-label="Опустить блок ниже"
                                title={
                                  index === orderedBlocks.length - 1
                                    ? 'Блок уже находится последним'
                                    : 'Опустить блок ниже'
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  applyDraft(
                                    moveBlock(ensureDraft(), stage.stageId, block.id, 'down'),
                                  );
                                }}
                              >
                                ↓ Опустить
                              </button>
                              <button
                                type="button"
                                className="admin-behavior-action-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  applyDraft(removeBlock(ensureDraft(), block.id));
                                  if (selectedBlockId === block.id) {
                                    setSelectedBlockId(null);
                                  }
                                }}
                              >
                                Удалить
                              </button>
                            </div>
                          </article>
                        ))}
                      {stage.blocks.length === 0 ? (
                        <p className="admin-muted">В этом этапе пока нет блоков.</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              <div className="admin-behavior-side">
                <section className="admin-behavior-card">
                  <h3>Настройка блока</h3>
                  {selectedBlock ? (
                    <BlockInspector
                      block={selectedBlock}
                      onChange={(nextBlock) => {
                        applyDraft(updateBlock(ensureDraft(), nextBlock.id, () => nextBlock));
                      }}
                    />
                  ) : (
                    <p className="admin-muted">Выберите блок, чтобы изменить настройки.</p>
                  )}
                </section>

                <section className="admin-behavior-card">
                  <h3>Preview prompt</h3>
                  <p className="admin-muted">
                    Длина: {preview?.stats.promptLength ?? 0} символов · Активных блоков:{' '}
                    {preview?.stats.activeBlockCount ?? 0}
                  </p>
                  <pre className="admin-behavior-preview">
                    {preview?.compiledPrompt ?? 'Prompt preview появится после загрузки.'}
                  </pre>
                </section>

                <section className="admin-behavior-card">
                  <h3>Проверки</h3>
                  {preview?.errors.length ? (
                    <div className="admin-behavior-validation">
                      <strong>Ошибки</strong>
                      <ul>
                        {preview.errors.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="admin-muted">Критических ошибок нет.</p>
                  )}
                  {preview?.warnings.length ? (
                    <div className="admin-behavior-validation">
                      <strong>Предупреждения</strong>
                      <ul>
                        {preview.warnings.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>

                {showVersions ? (
                  <section className="admin-behavior-card">
                    <h3>История версий</h3>
                    <div className="admin-behavior-version-list">
                      {versions.map((version) => (
                        <div key={version.id} className="admin-behavior-version-item">
                          <strong>v{version.version}</strong>
                          <span className="admin-order-status-pill">{version.status}</span>
                          <p className="admin-muted">
                            Автор: {version.createdBy ?? '—'} · Опубликовано:{' '}
                            {formatDate(version.publishedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="admin-empty">Выберите профиль поведения.</div>
        )}

        {error ? <p className="admin-error">{error}</p> : null}
      </section>
    </>
  );
}

function BlockInspector({
  block,
  onChange,
}: {
  block: BehaviorBlockDefinition;
  onChange: (block: BehaviorBlockDefinition) => void;
}) {
  const updateConfig = (key: string, value: string | boolean | number | string[]) => {
    onChange({
      ...block,
      config: {
        ...block.config,
        [key]: value,
      },
    });
  };

  return (
    <div className="admin-behavior-form">
      <p className="admin-muted">{BLOCK_LABELS[block.type]}</p>
      {block.type === 'PersonaBlock' ? (
        <>
          <label>
            <span>Роль</span>
            <input
              value={String(block.config.role ?? '')}
              onChange={(event) => updateConfig('role', event.target.value)}
            />
          </label>
          <label>
            <span>Цель</span>
            <textarea
              value={String(block.config.goal ?? '')}
              onChange={(event) => updateConfig('goal', event.target.value)}
            />
          </label>
        </>
      ) : null}

      {block.type === 'ToneBlock' ? (
        <>
          <label>
            <span>Тон</span>
            <select
              value={String(block.config.tone)}
              onChange={(event) => updateConfig('tone', event.target.value)}
            >
              <option value="neutral">Нейтральный</option>
              <option value="friendly">Дружелюбный</option>
              <option value="concise-business">Короткий деловой</option>
            </select>
          </label>
          <label>
            <span>Обращение</span>
            <select
              value={String(block.config.addressAs)}
              onChange={(event) => updateConfig('addressAs', event.target.value)}
            >
              <option value="вы">На вы</option>
              <option value="ты">На ты</option>
            </select>
          </label>
          <label className="admin-behavior-checkbox">
            <input
              type="checkbox"
              checked={Boolean(block.config.emojis)}
              onChange={(event) => updateConfig('emojis', event.target.checked)}
            />
            <span>Разрешить emoji</span>
          </label>
          <label>
            <span>Длина ответа</span>
            <select
              value={String(block.config.responseLength)}
              onChange={(event) => updateConfig('responseLength', event.target.value)}
            >
              <option value="short">Короткая</option>
              <option value="medium">Средняя</option>
            </select>
          </label>
        </>
      ) : null}

      {block.type === 'GreetingBlock' ? (
        <>
          <label>
            <span>Текст приветствия</span>
            <textarea
              value={String(block.config.greetingText ?? '')}
              onChange={(event) => updateConfig('greetingText', event.target.value)}
            />
          </label>
          <label className="admin-behavior-checkbox">
            <input
              type="checkbox"
              checked={Boolean(block.config.offerHelp)}
              onChange={(event) => updateConfig('offerHelp', event.target.checked)}
            />
            <span>Сразу предлагать помощь</span>
          </label>
        </>
      ) : null}

      {block.type === 'ProductSearchBlock' ? (
        <>
          <label>
            <span>Если товар не найден</span>
            <textarea
              value={String(block.config.zeroResultsText ?? '')}
              onChange={(event) => updateConfig('zeroResultsText', event.target.value)}
            />
          </label>
          <label>
            <span>Если вариантов несколько</span>
            <textarea
              value={String(block.config.multipleResultsText ?? '')}
              onChange={(event) => updateConfig('multipleResultsText', event.target.value)}
            />
          </label>
          <label>
            <span>Макс. вариантов</span>
            <input
              type="number"
              min={1}
              max={10}
              value={Number(block.config.maxOptions ?? 5)}
              onChange={(event) => updateConfig('maxOptions', Number(event.target.value))}
            />
          </label>
        </>
      ) : null}

      {block.type === 'CollectFieldBlock' ? (
        <>
          <label>
            <span>Поле</span>
            <select
              value={String(block.config.field)}
              onChange={(event) => updateConfig('field', event.target.value)}
            >
              {FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-behavior-checkbox">
            <input
              type="checkbox"
              checked={Boolean(block.config.required)}
              onChange={(event) => updateConfig('required', event.target.checked)}
            />
            <span>Обязательное поле</span>
          </label>
          <label>
            <span>Стиль вопроса</span>
            <select
              value={String(block.config.questionStyle)}
              onChange={(event) => updateConfig('questionStyle', event.target.value)}
            >
              <option value="short">Короткий</option>
              <option value="detailed">Подробный</option>
            </select>
          </label>
        </>
      ) : null}

      {block.type === 'ConfirmationBlock' ? (
        <>
          <label className="admin-behavior-checkbox">
            <input
              type="checkbox"
              checked={Boolean(block.config.requireExplicitConfirmation)}
              onChange={(event) =>
                updateConfig('requireExplicitConfirmation', event.target.checked)
              }
            />
            <span>Требовать явное подтверждение</span>
          </label>
          <div className="admin-behavior-checkbox-group">
            <span>Поля в summary</span>
            {SUMMARY_FIELD_OPTIONS.map((option) => {
              const values = Array.isArray(block.config.summaryFields)
                ? (block.config.summaryFields as string[])
                : [];
              const checked = values.includes(option.value);
              return (
                <label key={option.value} className="admin-behavior-checkbox">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const nextValues = event.target.checked
                        ? [...values, option.value]
                        : values.filter((value) => value !== option.value);
                      updateConfig('summaryFields', nextValues);
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </>
      ) : null}

      {block.type === 'CreateOrderBlock' ? (
        <>
          <label>
            <span>Сообщение после заказа</span>
            <textarea
              value={String(block.config.successTemplate ?? '')}
              onChange={(event) => updateConfig('successTemplate', event.target.value)}
            />
          </label>
          <label className="admin-behavior-checkbox">
            <input
              type="checkbox"
              checked={Boolean(block.config.includeOrderSummary)}
              onChange={(event) => updateConfig('includeOrderSummary', event.target.checked)}
            />
            <span>Повторять summary заказа</span>
          </label>
        </>
      ) : null}

      {block.type === 'StatusCheckBlock' ? (
        <>
          <label className="admin-behavior-checkbox">
            <input
              type="checkbox"
              checked={Boolean(block.config.allowStatusLookup)}
              onChange={(event) => updateConfig('allowStatusLookup', event.target.checked)}
            />
            <span>Разрешить проверку статуса</span>
          </label>
          <label>
            <span>Шаблон ответа</span>
            <textarea
              value={String(block.config.successTemplate ?? '')}
              onChange={(event) => updateConfig('successTemplate', event.target.value)}
            />
          </label>
        </>
      ) : null}

      {block.type === 'HandoffBlock' ? (
        <>
          <label className="admin-behavior-checkbox">
            <input
              type="checkbox"
              checked={Boolean(block.config.onExplicitRequest)}
              onChange={(event) => updateConfig('onExplicitRequest', event.target.checked)}
            />
            <span>Если клиент прямо просит оператора</span>
          </label>
          <label className="admin-behavior-checkbox">
            <input
              type="checkbox"
              checked={Boolean(block.config.onComplaint)}
              onChange={(event) => updateConfig('onComplaint', event.target.checked)}
            />
            <span>Если клиент недоволен</span>
          </label>
          <label className="admin-behavior-checkbox">
            <input
              type="checkbox"
              checked={Boolean(block.config.onAmbiguity)}
              onChange={(event) => updateConfig('onAmbiguity', event.target.checked)}
            />
            <span>Если ситуация неоднозначная</span>
          </label>
          <label>
            <span>Сообщение перед handoff</span>
            <textarea
              value={String(block.config.handoffMessage ?? '')}
              onChange={(event) => updateConfig('handoffMessage', event.target.value)}
            />
          </label>
        </>
      ) : null}

      {block.type === 'FallbackBlock' ? (
        <>
          <label>
            <span>Fallback-правило</span>
            <textarea
              value={String(block.config.fallbackText ?? '')}
              onChange={(event) => updateConfig('fallbackText', event.target.value)}
            />
          </label>
          <label className="admin-behavior-checkbox">
            <input
              type="checkbox"
              checked={Boolean(block.config.keepQuestionsShort)}
              onChange={(event) => updateConfig('keepQuestionsShort', event.target.checked)}
            />
            <span>Задавать короткие вопросы</span>
          </label>
        </>
      ) : null}

      {block.type === 'ForbiddenActionsBlock' ? (
        <>
          {[
            { key: 'forbidInventingProducts', label: 'Не выдумывать товары' },
            { key: 'forbidInventingPrices', label: 'Не выдумывать цены' },
            { key: 'forbidInventingStatuses', label: 'Не выдумывать статусы' },
            { key: 'russianOnly', label: 'Работать только на русском' },
          ].map((item) => (
            <label key={item.key} className="admin-behavior-checkbox">
              <input
                type="checkbox"
                checked={Boolean(block.config[item.key])}
                onChange={(event) => updateConfig(item.key, event.target.checked)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </>
      ) : null}

      {block.type === 'ResponseStyleBlock' ? (
        <>
          {[
            { key: 'bulletless', label: 'Не использовать лишние списки' },
            { key: 'askOneQuestionAtATime', label: 'Задавать один вопрос за раз' },
            {
              key: 'mentionOnlyKnownFacts',
              label: 'Упоминать только подтверждённые факты',
            },
          ].map((item) => (
            <label key={item.key} className="admin-behavior-checkbox">
              <input
                type="checkbox"
                checked={Boolean(block.config[item.key])}
                onChange={(event) => updateConfig(item.key, event.target.checked)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </>
      ) : null}
    </div>
  );
}
