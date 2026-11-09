import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { departmentsRouter } from "./modules/departments/departments.routes";
import { coursesRouter } from "./modules/courses/courses.routes";
import { studentsRouter } from "./modules/students/students.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));

app.use("/api/auth", authRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/students", studentsRouter);
app.use("/api/dashboard", dashboardRouter);

app.use(notFoundHandler);
app.use(errorHandler);
