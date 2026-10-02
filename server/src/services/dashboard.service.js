import * as dashboardRepository from '../repositories/dashboardRepository.js'

export async function getDashboard(userId, repository = dashboardRepository) {
  const [stats, recentDeployments, recentActivity] = await Promise.all([
    repository.getDashboardStats(userId),
    repository.getRecentDeployments(userId),
    repository.getRecentActivity(userId),
  ])

  return { stats, recentDeployments, recentActivity }
}