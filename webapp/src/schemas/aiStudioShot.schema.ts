import { z } from 'zod';

export const AIStudioShotRequestSchema = z.object({
  passA_baseImage: z.string().min(1, 'Pass A base image is required (Base64/URL)'),
  passB_logoMatte: z.string().optional(),
  contextPrompt: z.string().min(3, 'Context prompt must be at least 3 characters').max(1000),
  negativePrompt: z
    .string()
    .default('blurry, deformed mattress, crooked logo, lowres, distorted geometry, cartoon, oversaturated, text, watermark'),
  productMeta: z.object({
    mattressTier: z.enum(['cloud', 'lux', 'royal']),
    bedSet: z.enum(['kyoto', 'milan', 'solace']).optional(),
    aspectRatio: z.enum(['1:1', '16:9', '4:3']).default('1:1'),
    resolution: z.object({
      width: z.number().default(2048),
      height: z.number().default(2048),
    }),
  }),
  denoisingStrength: z.number().min(0.1).max(0.9).default(0.45),
});

export type AIStudioShotRequest = z.infer<typeof AIStudioShotRequestSchema>;

export const AIStudioShotResponseSchema = z.object({
  success: z.boolean(),
  generatedSceneUrl: z.string(),
  finalCompositeUrl: z.string().optional(),
  executionTimeMs: z.number(),
  auditHash: z.string().optional(),
});

export type AIStudioShotResponse = z.infer<typeof AIStudioShotResponseSchema>;
