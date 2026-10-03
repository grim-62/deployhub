import cors from 'cors'
import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { env } from './config/env.js'
import { database } from './config/database.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import authRoutes from './routes/authRoutes.js'
import adminRoutes from './routes/admin.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import githubRoutes from './routes/github.routes.js'
import healthRoutes from './routes/healthRoutes.js'
import workspaceRoutes from './routes/workspace.routes.js'

const app = express()
const PgSessionStore = connectPgSimple(session)
const store = database ? new PgSessionStore({ pool: database, tableName: 'sessions', createTableIfMissing: true }) : undefined

if (env.nodeEnv === 'production') app.set('trust proxy', 1)
app.use(cors({ origin: ['*','http://localhost:5173','http://localhost:5174'], credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(session({
	name: env.sessionCookieName,
	...(store ? { store } : {}),
	secret: env.sessionSecret,
	resave: false,
	saveUninitialized: false,
	cookie: {
		httpOnly: true,
		secure: env.nodeEnv === 'production',
		sameSite: 'lax',
		maxAge: 7 * 24 * 60 * 60 * 1000,
		path: '/',
	},
}))
app.use('/api', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/github', githubRoutes)
app.use('/api', workspaceRoutes)
app.use(notFound)
app.use(errorHandler)

export default app