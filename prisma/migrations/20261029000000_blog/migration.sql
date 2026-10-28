-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "blog_category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" JSONB NOT NULL,
    "coverUrl" TEXT,
    "coverAlt" TEXT,
    "categoryId" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "readingMinutes" INTEGER NOT NULL DEFAULT 1,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_category_slug_key" ON "blog_category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_slug_key" ON "blog_post"("slug");

-- CreateIndex
CREATE INDEX "blog_post_status_locale_publishedAt_idx" ON "blog_post"("status", "locale", "publishedAt");

-- AddForeignKey
ALTER TABLE "blog_post" ADD CONSTRAINT "blog_post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "blog_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post" ADD CONSTRAINT "blog_post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Starting categories; the consultant renames, adds or removes them in the Tableau de bord.
INSERT INTO "blog_category" ("id", "slug", "nameFr", "nameEn", "position", "updatedAt") VALUES
    ('blogcat_entree_express', 'entree-express', 'Entrée Express', 'Express Entry', 0, CURRENT_TIMESTAMP),
    ('blogcat_documents', 'documents', 'Documents', 'Documents', 1, CURRENT_TIMESTAMP),
    ('blogcat_langue', 'langue', 'Langue', 'Language', 2, CURRENT_TIMESTAMP),
    ('blogcat_equivalence', 'equivalence-diplomes', 'Équivalence de diplômes', 'Credential assessment', 3, CURRENT_TIMESTAMP),
    ('blogcat_strategie', 'strategie', 'Stratégie', 'Strategy', 4, CURRENT_TIMESTAMP),
    ('blogcat_conseils', 'conseils', 'Conseils', 'Advice', 5, CURRENT_TIMESTAMP);
