import { z } from "zod";

export const SessionInfoSchema = z.object({
	studentId: z.string(),
	schoolId: z.number(),
	isTeacher: z.boolean(),
});

export type SessionInfo = z.infer<typeof SessionInfoSchema>;
