import { z } from 'zod';

/**
 * Schema untuk Response Tenant Access Token Feishu (auth/v3/tenant_access_token/internal)
 */
export const FeishuTokenResponseSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  tenant_access_token: z.string().optional(),
  expire: z.number().optional(),
});

export type FeishuTokenResponseValidated = z.infer<typeof FeishuTokenResponseSchema>;

/**
 * Schema untuk Item Group Chat Feishu (im/v1/chats)
 */
export const FeishuChatItemSchema = z.object({
  chat_id: z.string(),
  avatar: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  owner_id: z.string().nullish(),
  owner_id_type: z.string().nullish(),
  external: z.boolean().nullish(),
  tenant_key: z.string().nullish(),
  user_count: z.union([z.string(), z.number()]).nullish(),
});

export const FeishuChatListResponseSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  data: z
    .object({
      has_more: z.boolean().optional(),
      page_token: z.string().optional(),
      items: z.array(FeishuChatItemSchema).optional().default([]),
    })
    .optional(),
});

export type FeishuChatListValidated = z.infer<typeof FeishuChatListResponseSchema>;

/**
 * Schema untuk Upload Image Response Feishu (im/v1/images)
 */
export const FeishuUploadImageResponseSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  data: z
    .object({
      image_key: z.string(),
    })
    .optional(),
});

export type FeishuUploadImageValidated = z.infer<typeof FeishuUploadImageResponseSchema>;

/**
 * Schema untuk Upload File Response Feishu (im/v1/files)
 */
export const FeishuUploadFileResponseSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  data: z
    .object({
      file_key: z.string(),
    })
    .optional(),
});

export type FeishuUploadFileValidated = z.infer<typeof FeishuUploadFileResponseSchema>;

/**
 * Schema untuk Send Message Response Feishu (im/v1/messages)
 */
export const FeishuSendMessageResponseSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  data: z
    .object({
      message_id: z.string(),
      root_id: z.string().optional(),
      parent_id: z.string().optional(),
      msg_type: z.string().optional(),
      create_time: z.string().optional(),
      update_time: z.string().optional(),
      deleted: z.boolean().optional(),
      updated: z.boolean().optional(),
      chat_id: z.string().optional(),
      sender: z
        .object({
          id: z.string().optional(),
          id_type: z.string().optional(),
          sender_type: z.string().optional(),
          tenant_key: z.string().optional(),
        })
        .optional(),
      body: z
        .object({
          content: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type FeishuSendMessageValidated = z.infer<typeof FeishuSendMessageResponseSchema>;

/**
 * Schema untuk Response Batch Get ID Feishu (contact/v3/users/batch_get_id)
 * Dipakai utk mencari Open ID (khusus scope app/bot ini) dari nomor HP/email.
 */
export const FeishuBatchGetIdResponseSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  data: z
    .object({
      user_list: z
        .array(
          z.object({
            user_id: z.string().optional(),
            mobile: z.string().optional(),
            email: z.string().nullish(),
          })
        )
        .optional()
        .default([]),
    })
    .optional(),
});

export type FeishuBatchGetIdValidated = z.infer<typeof FeishuBatchGetIdResponseSchema>;
