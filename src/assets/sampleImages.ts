import appleImage from './images/fresh_red_apple_1792771082759.jpg';

export const SAMPLE_APPLE_IMAGE = appleImage;

export const DEFAULT_SAMPLE_PRODUCT = {
  name: 'Apple',
  quantity: 5,
  weight: 1,
  weightUnit: 'kg' as const,
  price: 50,
  currency: '₹',
  description: 'Farm-fresh, crisp, sweet royal gala apples packed with nutrients.',
  imageUrl: appleImage,
};
