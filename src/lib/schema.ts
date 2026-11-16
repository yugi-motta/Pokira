import { z } from 'zod';

const imageSchema = z.object({
  src: z.string().regex(/^\/images\/announcements\/[a-z0-9/_-]+\.(avif|webp|jpe?g|png)$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  variants: z.array(z.object({
    src: z.string().regex(/^\/images\/announcements\/[a-z0-9/_-]+\.webp$/),
    width: z.number().int().positive()
  })).min(1),
  alt: z.string().min(1),
  permission: z.string().min(1)
});

const xMediaSchema = z.object({
  src: z.url().regex(/^https:\/\/pbs\.twimg\.com\/media\//),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});

export const announcementSchema = z.object({
  url: z.url(),
  tweetId: z.string().regex(/^\d{15,20}$/),
  date: z.iso.date(),
  pokemon: z.array(z.string().min(1)),
  kind: z.enum(['physical', 'pocket']),
  source: z.url(),
  images: z.array(imageSchema),
  media: z.array(xMediaSchema).default([])
});

export const artistSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  creditSource: z.url(),
  japaneseName: z.string().min(1).optional(),
  romanizedName: z.string().min(1).optional(),
  handle: z.string().regex(/^[A-Za-z0-9_]{1,15}$/).optional(),
  instagram: z.string().regex(/^(?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/).optional(),
  instagramSource: z.url().optional(),
  avatar: z.url().regex(/^https:\/\/pbs\.twimg\.com\/profile_images\//).optional(),
  gallery: z.array(imageSchema).default([]),
  announcements: z.array(announcementSchema).default([])
}).superRefine((artist, ctx) => {
  if (!artist.handle && !artist.instagram) ctx.addIssue({ code: 'custom', path: ['handle'], message: 'An X or Instagram profile is required.' });
  if (artist.instagram && !artist.instagramSource) ctx.addIssue({ code: 'custom', path: ['instagramSource'], message: 'Instagram profiles need identity evidence.' });
  if (artist.announcements.length && !artist.handle) ctx.addIssue({ code: 'custom', path: ['handle'], message: 'X announcements require an X handle.' });
  if (!artist.announcements.length && !artist.gallery.length) ctx.addIssue({ code: 'custom', path: ['gallery'], message: 'Artists without X announcements need permitted gallery images.' });
});

export type Artist = z.infer<typeof artistSchema>;
export type Announcement = z.infer<typeof announcementSchema>;
