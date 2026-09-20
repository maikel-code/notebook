import { z } from "zod"

export const generatedAnswerSchema = z.discriminatedUnion("kind", [
  z
    .object({
      claims: z
        .array(
          z
            .object({
              citations: z
                .array(
                  z
                    .object({ chunkNumber: z.number().int().positive(), quote: z.string().min(1) })
                    .strict(),
                )
                .min(1),
              text: z
                .string()
                .trim()
                .min(1)
                .refine((value) => !/[\r\n]/.test(value)),
            })
            .strict(),
        )
        .min(1),
      kind: z.literal("answer"),
    })
    .strict(),
  z.object({ kind: z.literal("unsupported") }).strict(),
])

export type GeneratedAnswer = z.infer<typeof generatedAnswerSchema>
