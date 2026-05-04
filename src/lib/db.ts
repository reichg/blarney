import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaSignature?: string;
};

const requiredPrismaDelegates = ["registrationCheckout"] as const;

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/blarney?schema=public";

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn"] : [],
  });
}

function getPrismaSchemaSignature() {
  return JSON.stringify(
    Prisma.dmmf.datamodel.models.map((model) => ({
      name: model.name,
      fields: model.fields.map((field) => ({
        name: field.name,
        type: field.type,
        kind: field.kind,
        isList: field.isList,
        isRequired: field.isRequired,
      })),
    })),
  );
}

function getDevelopmentPrismaClient() {
  const schemaSignature = getPrismaSchemaSignature();
  const hasRequiredDelegates = requiredPrismaDelegates.every(
    (delegate) => delegate in (globalForPrisma.prisma ?? {}),
  );

  if (
    !globalForPrisma.prisma ||
    globalForPrisma.prismaSchemaSignature !== schemaSignature ||
    !hasRequiredDelegates
  ) {
    void globalForPrisma.prisma?.$disconnect().catch(() => undefined);

    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaSchemaSignature = schemaSignature;
  }

  return globalForPrisma.prisma;
}

export const db =
  process.env.NODE_ENV === "production"
    ? createPrismaClient()
    : getDevelopmentPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
