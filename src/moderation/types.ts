export type ModerationDecision = {
  allowed: boolean;
  action: 'keep' | 'delete' | 'review' | 'reject';
  reasons: string[];
  categories?: Record<string, boolean>;
  raw?: any;
};

export type TextContext =
  | 'first_name'
  | 'last_name'
  | 'username'
  | 'bio'
  | 'post';

export type ImagePurpose = 'avatar' | 'post_image' | 'cover' | 'attachment';
