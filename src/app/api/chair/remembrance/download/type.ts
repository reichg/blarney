import { z } from "zod";

export const remembranceBulkDownloadSchema = z
  .object({
    ids: z.array(z.string().trim().min(1)).max(200).optional(),
    mode: z.enum(["selected", "all"]).default("selected"),
  })
  .superRefine((value, context) => {
    if (value.mode === "selected" && (!value.ids || value.ids.length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one remembrance photo.",
        path: ["ids"],
      });
    }

    if (value.mode === "all" && value.ids) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Do not send ids when requesting all remembrance photos.",
        path: ["ids"],
      });
    }
  })
  .transform((value) => ({
    mode: value.mode,
    ids: value.ids ? Array.from(new Set(value.ids)) : undefined,
  }));
