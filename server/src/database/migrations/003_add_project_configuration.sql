ALTER TABLE projects ADD COLUMN IF NOT EXISTS repository_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT 'main';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT CHECK (project_type IS NULL OR project_type IN ('frontend', 'backend'));
ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'NOT_DEPLOYED';