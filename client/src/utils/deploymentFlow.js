export function getProjectNavigationTarget(deployment) {
  if (!deployment || !deployment.projectId) return null
  if (deployment.status === 'LIVE') {
    return `/projects/${deployment.projectId}`
  }

  return null
}
