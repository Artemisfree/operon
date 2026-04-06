import { hash } from 'bcryptjs';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const courierToken = 'courier-dev-token';
  const courierTokenHash = await hash(courierToken, 10);

  await prisma.courier.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {
      displayName: 'Демо-курьер',
      phone: '+79990001122',
      isActive: true,
      apiTokenHash: courierTokenHash,
    },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      displayName: 'Демо-курьер',
      phone: '+79990001122',
      isActive: true,
      apiTokenHash: courierTokenHash,
    },
  });

  const passwordHash = await hash('admin12345', 10);

  await prisma.adminUser.upsert({
    where: { email: 'admin@operon.local' },
    update: {
      passwordHash,
      role: 'admin',
    },
    create: {
      email: 'admin@operon.local',
      passwordHash,
      role: 'admin',
    },
  });

  const products = [
    {
      name: 'Капучино 300 мл',
      description: 'Классический капучино на молоке',
      price: new Prisma.Decimal('220.00'),
    },
    {
      name: 'Латте 400 мл',
      description: 'Мягкий кофе с увеличенной порцией молока',
      price: new Prisma.Decimal('260.00'),
    },
    {
      name: 'Сэндвич с индейкой',
      description: 'Горячий сэндвич с индейкой и сыром',
      price: new Prisma.Decimal('340.00'),
    },
    {
      name: 'Чизкейк',
      description: 'Порционный десерт',
      price: new Prisma.Decimal('290.00'),
    },
    {
      name: 'Апельсиновый фреш',
      description: 'Свежевыжатый сок 300 мл',
      price: new Prisma.Decimal('310.00'),
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { name: product.name },
      update: {
        description: product.description,
        price: product.price,
        currency: 'RUB',
        isActive: true,
      },
      create: {
        ...product,
        currency: 'RUB',
        isActive: true,
      },
    });
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
