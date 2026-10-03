import { database } from '../config/database.js'
import { AppError } from '../utils/AppError.js'

const successfulStatuses = ['success', 'successful', 'live', 'deployed']
const failedStatuses = ['failed', 'failure', 'error']

function getDatabase() {
  if (!database) throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is not configured.')
  return database
}

export async function getDashboardStats(userId) {
  const result = await getDatabase().query(
    `SELECT
       (SELECT COUNT(*)::int FROM projects WHERE user_id = $1) AS projects,
       COUNT(*)::int AS deployments,
       COUNT(*) FILTER (WHERE LOWER(status) = ANY($2::text[]))::int AS successful,
       COUNT(*) FILTER (WHERE LOWER(status) = ANY($3::text[]))::int AS failed
     FROM deployments
     WHERE user_id = $1`,
    [userId, successfulStatuses, failedStatuses],
  )
  return result.rows[0]
}

export async function getRecentDeployments(userId) {
  const result = await getDatabase().query(
    `SELECT d.id, d.commit_sha AS "commitSha", d.branch, d.status,
       d.duration, d.created_at AS "createdAt", p.name AS "projectName"
     FROM deployments d
     JOIN projects p ON p.id = d.project_id AND p.user_id = d.user_id
     WHERE d.user_id = $1
     ORDER BY d.created_at DESC, d.id DESC
     LIMIT 8`,
    [userId],
  )
  return result.rows
}

export async function getRecentActivity(userId) {
  const result = await getDatabase().query(
    `SELECT a.id, a.type, a.message, a.created_at AS "createdAt",
       p.name AS "projectName", a.deployment_id AS "deploymentId"
     FROM activity a
     LEFT JOIN projects p ON p.id = a.project_id AND p.user_id = a.user_id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT 8`,
    [userId],
  )
  return result.rows
}

export async function listProjects(userId) {
  const result = await getDatabase().query(
    `SELECT id, name, repository_full_name AS "repositoryFullName", framework,
       repository_url AS "repositoryUrl", branch, project_type AS "projectType",
       production_url AS "productionUrl", status, created_at AS "createdAt",
       updated_at AS "updatedAt"
     FROM projects
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC`,
    [userId],
  )
  return result.rows
}

export async function listAdminLiveProjects() {
  const result = await getDatabase().query(
    `SELECT p.id, p.name, p.repository_full_name AS "repositoryFullName",
       p.branch, p.project_type AS "projectType", p.status,
       p.production_url AS "productionUrl", p.updated_at AS "updatedAt",
       u.github_username AS "ownerGithubUsername"
     FROM projects p
     JOIN users u ON u.id = p.user_id
     WHERE UPPER(p.status) = 'LIVE'
     ORDER BY p.updated_at DESC, p.id DESC`,
  )
  return result.rows
}

export async function getAdminProjectDetails(projectId) {
  const projectResult = await getDatabase().query(
    `SELECT p.id, p.user_id AS "ownerId", p.name,
       p.repository_full_name AS "repositoryFullName", p.repository_url AS "repositoryUrl",
       p.branch, p.project_type AS "projectType", p.status,
       p.production_url AS "productionUrl", p.created_at AS "createdAt",
       p.updated_at AS "updatedAt", u.github_username AS "ownerGithubUsername"
     FROM projects p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1 AND UPPER(p.status) = 'LIVE'`,
    [projectId],
  )
  const project = projectResult.rows[0]
  if (!project) return null

  const deploymentsResult = await getDatabase().query(
    `SELECT id, branch, status, commit_sha AS "commitSha",
       deployment_url AS "deploymentUrl", duration,
       created_at AS "createdAt", updated_at AS "updatedAt"
     FROM deployments
     WHERE project_id = $1 AND user_id = $2
     ORDER BY created_at DESC, id DESC
     LIMIT 20`,
    [projectId, project.ownerId],
  )
  return { project, deployments: deploymentsResult.rows }
}

export async function createProject(userId, { repository, projectType, branch, environmentVariablesEncrypted }) {
  const result = await getDatabase().query(
    `INSERT INTO projects
       (user_id, name, repository_id, repository_full_name, repository_url,
      branch, project_type, environment_variables_encrypted, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NOT_DEPLOYED')
     ON CONFLICT (user_id, repository_id) DO NOTHING
     RETURNING id, name, repository_id AS "repositoryId",
       repository_full_name AS "repositoryFullName", repository_url AS "repositoryUrl",
       branch, project_type AS "projectType", status, created_at AS "createdAt"`,
    [
      userId,
      repository.name,
      repository.id,
      repository.fullName,
      repository.htmlUrl,
      branch || repository.defaultBranch || 'main',
      projectType,
      environmentVariablesEncrypted,
    ],
  )
  return result.rows[0] ?? null
}

export async function listDeployments(userId) {
  const result = await getDatabase().query(
    `SELECT d.id, d.commit_sha AS "commitSha", d.branch, d.status,
       d.duration, d.created_at AS "createdAt", p.name AS "projectName"
     FROM deployments d
     JOIN projects p ON p.id = d.project_id AND p.user_id = d.user_id
     WHERE d.user_id = $1
     ORDER BY d.created_at DESC, d.id DESC`,
    [userId],
  )
  return result.rows
}

export async function listActivity(userId) {
  const result = await getDatabase().query(
    `SELECT a.id, a.type, a.message, a.created_at AS "createdAt",
       p.name AS "projectName", a.deployment_id AS "deploymentId"
     FROM activity a
     LEFT JOIN projects p ON p.id = a.project_id AND p.user_id = a.user_id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC, a.id DESC`,
    [userId],
  )
  return result.rows
}

export async function getDeployment(userId, deploymentId) {
  const result = await getDatabase().query(
    `SELECT d.id, d.project_id AS "projectId", d.commit_sha AS "commitSha",
       d.branch, d.status, d.deployment_url AS "deploymentUrl",
       d.created_at AS "createdAt", d.updated_at AS "updatedAt",
       p.name AS "projectName", p.repository_full_name AS "repositoryFullName"
     FROM deployments d
     JOIN projects p ON p.id = d.project_id AND p.user_id = d.user_id
     WHERE d.user_id = $1 AND d.id = $2`,
    [userId, deploymentId],
  )
  return result.rows[0] ?? null
}

export async function getDeploymentLogs(userId, deploymentId) {
  const result = await getDatabase().query(
    'SELECT logs FROM deployments WHERE user_id = $1 AND id = $2',
    [userId, deploymentId],
  )
  return result.rows[0]?.logs ?? null
}

export async function getProject(userId, projectId) {
  const result = await getDatabase().query(
    `SELECT id, name, repository_id AS "repositoryId",
       repository_full_name AS "repositoryFullName", repository_url AS "repositoryUrl",
       branch, project_type AS "projectType", status,
       production_url AS "productionUrl", created_at AS "createdAt",
       updated_at AS "updatedAt"
     FROM projects
     WHERE user_id = $1 AND id = $2`,
    [userId, projectId],
  )
  return result.rows[0] ?? null
}

export async function deleteProject(userId, projectId) {
  const client = await getDatabase().connect()
  try {
    await client.query('BEGIN')
    const projectResult = await client.query(
      `SELECT id, status, container_id AS "containerId",
         production_url AS "productionUrl"
       FROM projects WHERE user_id = $1 AND id = $2 FOR UPDATE`,
      [userId, projectId],
    )
    const project = projectResult.rows[0]
    if (!project) {
      await client.query('ROLLBACK')
      return null
    }

    const activeDeployment = await client.query(
      `SELECT 1 FROM deployments
       WHERE user_id = $1 AND project_id = $2
         AND UPPER(status) = ANY($3::text[])
       LIMIT 1`,
      [userId, projectId, ['QUEUED', 'BUILDING', 'DEPLOYING']],
    )
    if (['QUEUED', 'BUILDING', 'DEPLOYING'].includes(String(project.status).toUpperCase()) || activeDeployment.rowCount > 0) {
      throw new AppError(409, 'DEPLOYMENT_IN_PROGRESS', 'Wait for the active deployment to finish before deleting this project.')
    }

    const deletedProject = await client.query(
      `DELETE FROM projects WHERE user_id = $1 AND id = $2
       RETURNING id, container_id AS "containerId", production_url AS "productionUrl"`,
      [userId, projectId],
    )
    await client.query('COMMIT')
    return deletedProject.rows[0] ?? null
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function queueProjectDeployment(userId, projectId) {
  const databaseClient = getDatabase()
  const client = await databaseClient.connect()
  try {
    await client.query('BEGIN')
    const projectResult = await client.query(
      'SELECT id, branch, status FROM projects WHERE user_id = $1 AND id = $2 FOR UPDATE',
      [userId, projectId],
    )
    const project = projectResult.rows[0]
    if (!project) {
      await client.query('ROLLBACK')
      return null
    }
    if (['QUEUED', 'BUILDING', 'DEPLOYING'].includes(project.status)) {
      throw new AppError(409, 'DEPLOYMENT_IN_PROGRESS', 'A deployment is already in progress for this project.')
    }

    const deploymentResult = await client.query(
      `INSERT INTO deployments (project_id, user_id, branch, status, logs)
       VALUES ($1, $2, $3, 'QUEUED', '')
       RETURNING id, project_id AS "projectId", status, created_at AS "createdAt"`,
      [project.id, userId, project.branch],
    )
    await client.query(
      `UPDATE projects SET status = 'QUEUED', updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [project.id, userId],
    )
    await client.query('COMMIT')
    return deploymentResult.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function claimNextDeployment() {
  const pool = getDatabase()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `SELECT d.id AS "deploymentId", d.project_id AS "projectId", d.user_id AS "userId",
         p.name AS "projectName", p.repository_url AS "repositoryUrl", p.repository_full_name AS "repositoryFullName",
         p.branch, p.project_type AS "projectType",
         p.environment_variables_encrypted AS "environmentVariablesEncrypted",
         u.github_access_token AS "accessToken"
       FROM deployments d
       JOIN projects p ON p.id = d.project_id AND p.user_id = d.user_id
       JOIN users u ON u.id = d.user_id
       WHERE d.status = 'QUEUED'
       ORDER BY d.created_at, d.id
      LIMIT 1
      FOR UPDATE OF d SKIP LOCKED`,
    )
    const deployment = result.rows[0]
    if (!deployment) {
      await client.query('COMMIT')
      return null
    }
    await client.query('SELECT pg_advisory_xact_lock($1)', [31000])
    const usedPortsResult = await client.query(
      `SELECT container_port AS port FROM projects WHERE container_id IS NOT NULL AND container_port IS NOT NULL
       UNION SELECT container_port AS port FROM deployments
       WHERE status IN ('BUILDING', 'DEPLOYING') AND container_port IS NOT NULL`,
    )
    const usedPorts = new Set(usedPortsResult.rows.map((row) => row.port))
    let containerPort = 31000
    while (containerPort <= 65535 && usedPorts.has(containerPort)) containerPort += 1
    if (containerPort > 65535) {
      const message = 'Deployment failed: no container ports are available.'
      await client.query(
        `UPDATE deployments SET status = 'FAILED', logs = logs || $2 || E'\\n', updated_at = NOW()
         WHERE id = $1`,
        [deployment.deploymentId, message],
      )
      await client.query(
        `UPDATE projects SET status = CASE WHEN container_id IS NULL THEN 'FAILED' ELSE 'LIVE' END, updated_at = NOW()
         WHERE id = $1`,
        [deployment.projectId],
      )
      await client.query('COMMIT')
      return null
    }
    await client.query(
      "UPDATE deployments SET status = 'BUILDING', container_port = $2, updated_at = NOW() WHERE id = $1",
      [deployment.deploymentId, containerPort],
    )
    await client.query("UPDATE projects SET status = 'BUILDING', updated_at = NOW() WHERE id = $1", [deployment.projectId])
    await client.query('COMMIT')
    return { ...deployment, containerPort }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function appendDeploymentLog(deploymentId, message) {
  await getDatabase().query(
    'UPDATE deployments SET logs = logs || $2 || E\'\\n\', updated_at = NOW() WHERE id = $1',
    [deploymentId, message],
  )
}

export async function updateDeploymentStatus(deploymentId, projectId, status) {
  const client = await getDatabase().connect()
  try {
    await client.query('BEGIN')
    await client.query('UPDATE deployments SET status = $2, updated_at = NOW() WHERE id = $1', [deploymentId, status])
    await client.query('UPDATE projects SET status = $2, updated_at = NOW() WHERE id = $1', [projectId, status])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function completeDeployment(deployment) {
  const client = await getDatabase().connect()
  try {
    await client.query('BEGIN')
    const previousProject = await client.query(
      'SELECT container_id AS "containerId" FROM projects WHERE id = $1 FOR UPDATE',
      [deployment.projectId],
    )
    await client.query(
      `UPDATE deployments SET status = 'LIVE', deployment_url = $2, commit_sha = $3,
         container_port = $4, logs = logs || $5 || E'\\n', updated_at = NOW()
       WHERE id = $1`,
      [deployment.deploymentId, deployment.url, deployment.commitSha, deployment.containerPort, `Deployment is live at ${deployment.url}.`],
    )
    await client.query(
      `UPDATE projects SET status = 'LIVE', production_url = $2,
        container_id = $3, container_port = $4, updated_at = NOW()
       WHERE id = $1`,
      [deployment.projectId, deployment.url, deployment.containerId, deployment.containerPort],
    )
    await client.query('COMMIT')
    return previousProject.rows[0]?.containerId ?? null
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function failDeployment(deployment, message) {
  const client = await getDatabase().connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE deployments SET status = 'FAILED', logs = logs || $2 || E'\\n', updated_at = NOW()
       WHERE id = $1`,
      [deployment.deploymentId, message],
    )
    await client.query(
      `UPDATE projects SET status = CASE WHEN container_id IS NULL THEN 'FAILED' ELSE 'LIVE' END,
        updated_at = NOW() WHERE id = $1`,
      [deployment.projectId],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}