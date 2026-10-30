import { type CatalogProduct, type OrderEditorSettings } from '../../types/schemas';
import { logger } from '../logger';

// Default catalog of store products for test/demo store
const DEMO_STORE_CATALOG: CatalogProduct[] = [
  {
    id: 'prod-tote-02',
    name: 'Heavyweight Canvas Tote',
    description: '100% organic unbleached cotton with reinforced dual-stitch handles.',
    price: 22.0,
    formattedPrice: '$22.00',
    currency: 'USD',
    mainMedia: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=80',
    mediaItems: ['https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=80'],
    inStock: true,
    manageVariants: false,
    variants: [],
    options: [],
  },
  {
    id: 'prod-brush-04',
    name: 'Silicone Cleaning Brush Set',
    description: 'Eco-friendly bottle & tumbler cleaning wand with antibacterial bristles.',
    price: 14.5,
    formattedPrice: '$14.50',
    currency: 'USD',
    mainMedia: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    mediaItems: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'],
    inStock: true,
    manageVariants: false,
    variants: [],
    options: [],
  },
  {
    id: 'prod-socks-05',
    name: 'Merino Wool Trail Socks (3-Pack)',
    description: 'Cushioned heel and seamless toe box for all-day comfort.',
    price: 18.0,
    formattedPrice: '$18.00',
    currency: 'USD',
    mainMedia: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=500&auto=format&fit=crop&q=80',
    mediaItems: ['https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=500&auto=format&fit=crop&q=80'],
    inStock: true,
    manageVariants: true,
    variants: [
      { id: 'var-socks-m', title: 'Medium (US 7-9)', price: 18.0, inStock: true },
      { id: 'var-socks-l', title: 'Large (US 10-13)', price: 18.0, inStock: true },
    ],
    options: [
      { name: 'Size', choices: ['Medium (US 7-9)', 'Large (US 10-13)'] },
    ],
  },
  {
    id: 'prod-coffee-06',
    name: 'Single Origin Whole Bean Coffee',
    description: 'Ethiopian Yirgacheffe with notes of bergamot, jasmine, and lemon zest.',
    price: 19.5,
    formattedPrice: '$19.50',
    currency: 'USD',
    mainMedia: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=80',
    mediaItems: ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=80'],
    inStock: true,
    manageVariants: true,
    variants: [
      { id: 'var-coffee-whole', title: 'Whole Bean', price: 19.5, inStock: true },
      { id: 'var-coffee-ground', title: 'Coarse Ground', price: 19.5, inStock: true },
    ],
    options: [
      { name: 'Grind', choices: ['Whole Bean', 'Coarse Ground'] },
    ],
  },
  {
    id: 'prod-candle-07',
    name: 'Hand-Poured Soy Wax Candle',
    description: 'Amber & Cedarwood 8oz candle with clean-burning wood wick.',
    price: 24.0,
    formattedPrice: '$24.00',
    currency: 'USD',
    mainMedia: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500&auto=format&fit=crop&q=80',
    mediaItems: ['https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500&auto=format&fit=crop&q=80'],
    inStock: true,
    manageVariants: false,
    variants: [],
    options: [],
  },
  {
    id: 'prod-cap-08',
    name: 'Low Profile Vintage Twill Cap',
    description: 'Unstructured 6-panel hat with brass buckle closure.',
    price: 26.0,
    formattedPrice: '$26.00',
    currency: 'USD',
    mainMedia: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&auto=format&fit=crop&q=80',
    mediaItems: ['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&auto=format&fit=crop&q=80'],
    inStock: true,
    manageVariants: true,
    variants: [
      { id: 'var-cap-black', title: 'Washed Black', price: 26.0, inStock: true },
      { id: 'var-cap-olive', title: 'Forest Olive', price: 26.0, inStock: true },
    ],
    options: [
      { name: 'Color', choices: ['Washed Black', 'Forest Olive'] },
    ],
  },
];

export class CatalogService {
  /**
   * Retrieves products for post-purchase addition.
   * All in-stock store products are eligible.
   */
  async getEligibleProducts(settings?: OrderEditorSettings): Promise<CatalogProduct[]> {
    logger.info('Fetching catalog products for post-purchase addition (all products eligible)');

    // All catalog products in stock are eligible
    return DEMO_STORE_CATALOG.filter((p) => p.inStock);
  }

  /**
   * Validates product addition against merchant quantity/value constraints.
   * All products are eligible.
   */
  async validateProductAddition(
    settings: OrderEditorSettings,
    productId: string,
    quantity: number,
    currentAddedCount: number,
    currentAddedTotalValue: number
  ): Promise<{ valid: boolean; product?: CatalogProduct; reason?: string }> {
    const product = DEMO_STORE_CATALOG.find((p) => p.id === productId);

    if (!product) {
      return { valid: false, reason: 'Product not found in catalog' };
    }

    if (!product.inStock) {
      return { valid: false, reason: 'Product is currently out of stock' };
    }

    if (quantity > settings.maxAddedQuantity) {
      return {
        valid: false,
        reason: `Quantity exceeds merchant limit of ${settings.maxAddedQuantity} per item`,
      };
    }

    if (currentAddedCount + 1 > settings.maxDistinctAddedProducts) {
      return {
        valid: false,
        reason: `Maximum distinct added products limit (${settings.maxDistinctAddedProducts}) reached`,
      };
    }

    const additionalValue = product.price * quantity;
    if (settings.maxAdditionalValue !== null && (currentAddedTotalValue + additionalValue > settings.maxAdditionalValue)) {
      return {
        valid: false,
        reason: `Exceeds merchant maximum additional order value of $${settings.maxAdditionalValue}`,
      };
    }

    return { valid: true, product };
  }
}

export const catalogService = new CatalogService();
