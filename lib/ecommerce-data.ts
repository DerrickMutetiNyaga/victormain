// ============================================
// ECOMMERCE DUMMY DATA FOR ONLINE SHOP
// ============================================

export interface EcommerceProduct {
  id: string
  name: string
  category: "Infused Jaba" | "Liquor" | "Spirits" | "Wines" | "Soft Drinks"
  price: number
  originalPrice?: number
  image: string
  description: string
  sizes: { size: string; price: number; available: boolean; stock?: number }[]
  rating: number
  reviewCount: number
  reviews: Review[]
  inStock: boolean
  featured?: boolean
  trending?: boolean
  isJaba?: boolean
}

/** Display product as "Name Size" e.g. "Mojito 250ml" or "Old Monk 750ml" */
export function getProductDisplayName(product: EcommerceProduct): string {
  const size = product.sizes?.[0]?.size
  if (size && size !== "Standard") return `${product.name} ${size}`
  return product.name
}

export interface Review {
  id: string
  userName: string
  rating: number
  comment: string
  date: string
  verified: boolean
}

export interface Category {
  id: string
  name: string
  image: string
  productCount: number
}

// 20 Liquor Products
const liquorProducts: EcommerceProduct[] = [
  {
    id: "liq001",
    name: "Johnnie Walker Black Label",
    category: "Spirits",
    price: 8500,
    originalPrice: 9500,
    image: "/johnnie-walker-black-label-whiskey-bottle.jpg",
    description: "Premium blended Scotch whisky with rich, complex flavors of vanilla, toffee, and dark fruit.",
    sizes: [
      { size: "500ml", price: 4500, available: true },
      { size: "1L", price: 8500, available: true },
      { size: "2L", price: 16000, available: false },
    ],
    rating: 4.8,
    reviewCount: 234,
    reviews: [
      { id: "r1", userName: "James M.", rating: 5, comment: "Excellent quality, smooth finish!", date: "2024-01-15", verified: true },
      { id: "r2", userName: "Sarah K.", rating: 4, comment: "Great value for money", date: "2024-01-10", verified: true },
    ],
    inStock: true,
    featured: true,
    trending: true,
  },
  {
    id: "liq002",
    name: "Absolut Vodka",
    category: "Spirits",
    price: 3200,
    image: "/absolut-vodka-bottle.jpg",
    description: "Premium Swedish vodka known for its smooth, clean taste and versatility.",
    sizes: [
      { size: "500ml", price: 1800, available: true },
      { size: "1L", price: 3200, available: true },
      { size: "2L", price: 6000, available: true },
    ],
    rating: 4.6,
    reviewCount: 189,
    reviews: [],
    inStock: true,
    trending: true,
  },
  {
    id: "liq003",
    name: "Bacardi Superior White Rum",
    category: "Spirits",
    price: 2800,
    image: "/bacardi-superior-white-rum.png",
    description: "Smooth, light-bodied rum perfect for cocktails and mixing.",
    sizes: [
      { size: "500ml", price: 1500, available: true },
      { size: "1L", price: 2800, available: true },
      { size: "2L", price: 5200, available: false },
    ],
    rating: 4.5,
    reviewCount: 156,
    reviews: [],
    inStock: true,
  },
  {
    id: "liq004",
    name: "Bombay Sapphire Gin",
    category: "Spirits",
    price: 4200,
    image: "/bombay-sapphire-gin.png",
    description: "Premium London dry gin with a complex botanical blend.",
    sizes: [
      { size: "500ml", price: 2200, available: true },
      { size: "1L", price: 4200, available: true },
      { size: "2L", price: 7800, available: false },
    ],
    rating: 4.7,
    reviewCount: 201,
    reviews: [],
    inStock: true,
    featured: true,
  },
  {
    id: "liq005",
    name: "Jack Daniel's Tennessee Whiskey",
    category: "Spirits",
    price: 5500,
    image: "/jack-daniels-tennessee-whiskey-bottle.jpg",
    description: "Smooth, mellow Tennessee whiskey with notes of caramel and vanilla.",
    sizes: [
      { size: "500ml", price: 3000, available: true },
      { size: "1L", price: 5500, available: true },
      { size: "2L", price: 10500, available: false },
    ],
    rating: 4.9,
    reviewCount: 312,
    reviews: [],
    inStock: true,
    trending: true,
  },
  {
    id: "liq006",
    name: "Jameson Irish Whiskey",
    category: "Spirits",
    price: 3800,
    image: "/jameson-whiskey-bottle.png",
    description: "Triple-distilled Irish whiskey with smooth, balanced flavors.",
    sizes: [
      { size: "500ml", price: 2000, available: true },
      { size: "1L", price: 3800, available: true },
      { size: "2L", price: 7200, available: false },
    ],
    rating: 4.6,
    reviewCount: 178,
    reviews: [],
    inStock: true,
  },
  {
    id: "liq007",
    name: "Smirnoff Red Vodka",
    category: "Spirits",
    price: 2500,
    image: "/smirnoff-red-vodka-bottle.jpg",
    description: "Classic Russian vodka, crisp and clean.",
    sizes: [
      { size: "500ml", price: 1300, available: true },
      { size: "1L", price: 2500, available: true },
      { size: "2L", price: 4800, available: true },
    ],
    rating: 4.4,
    reviewCount: 145,
    reviews: [],
    inStock: true,
  },
  {
    id: "liq008",
    name: "Grey Goose Vodka",
    category: "Spirits",
    price: 6800,
    image: "/grey-goose-vodka-bottle-premium.jpg",
    description: "Ultra-premium French vodka made from soft winter wheat.",
    sizes: [
      { size: "500ml", price: 3600, available: true },
      { size: "1L", price: 6800, available: true },
      { size: "2L", price: 13000, available: false },
    ],
    rating: 4.9,
    reviewCount: 267,
    reviews: [],
    inStock: true,
    featured: true,
  },
  {
    id: "liq009",
    name: "Belvedere Vodka",
    category: "Spirits",
    price: 7200,
    image: "/belvedere-vodka-premium-bottle.jpg",
    description: "Luxury Polish vodka with exceptional smoothness.",
    sizes: [
      { size: "500ml", price: 3800, available: true },
      { size: "1L", price: 7200, available: true },
      { size: "2L", price: 13800, available: false },
    ],
    rating: 4.8,
    reviewCount: 198,
    reviews: [],
    inStock: true,
  },
  {
    id: "liq010",
    name: "Ciroc Vodka",
    category: "Spirits",
    price: 5800,
    image: "/ciroc-vodka.png",
    description: "Premium French vodka made from grapes.",
    sizes: [
      { size: "500ml", price: 3100, available: true },
      { size: "1L", price: 5800, available: true },
      { size: "2L", price: 11000, available: false },
    ],
    rating: 4.7,
    reviewCount: 223,
    reviews: [],
    inStock: true,
  },
  {
    id: "liq011",
    name: "Chivas Regal 12 Year",
    category: "Spirits",
    price: 9200,
    image: "/chivas-regal-12-year-scotch-whiskey.jpg",
    description: "Smooth blended Scotch whisky aged 12 years.",
    sizes: [
      { size: "500ml", price: 4800, available: true },
      { size: "1L", price: 9200, available: true },
      { size: "2L", price: 17500, available: false },
    ],
    rating: 4.8,
    reviewCount: 289,
    reviews: [],
    inStock: true,
    featured: true,
  },
  {
    id: "liq012",
    name: "Glenfiddich 12 Year",
    category: "Spirits",
    price: 10500,
    image: "/glenfiddich-12-year-scotch-whiskey.jpg",
    description: "Single malt Scotch whisky with notes of pear and oak.",
    sizes: [
      { size: "500ml", price: 5500, available: true },
      { size: "1L", price: 10500, available: true },
      { size: "2L", price: 20000, available: false },
    ],
    rating: 4.9,
    reviewCount: 345,
    reviews: [],
    inStock: true,
    trending: true,
  },
  {
    id: "liq013",
    name: "Captain Morgan Spiced Rum",
    category: "Spirits",
    price: 3200,
    image: "/captain-morgan-spiced-rum-bottle.jpg",
    description: "Smooth spiced rum with warm vanilla and cinnamon notes.",
    sizes: [
      { size: "500ml", price: 1700, available: true },
      { size: "1L", price: 3200, available: true },
      { size: "2L", price: 6000, available: true },
    ],
    rating: 4.5,
    reviewCount: 167,
    reviews: [],
    inStock: true,
  },
  {
    id: "liq014",
    name: "Havana Club 7 Year",
    category: "Spirits",
    price: 3800,
    image: "/havana-club-7-year-rum-bottle.jpg",
    description: "Aged Cuban rum with rich, complex flavors.",
    sizes: [
      { size: "500ml", price: 2000, available: true },
      { size: "1L", price: 3800, available: true },
      { size: "2L", price: 7200, available: false },
    ],
    rating: 4.6,
    reviewCount: 192,
    reviews: [],
    inStock: true,
  },
  {
    id: "liq015",
    name: "Beefeater London Dry Gin",
    category: "Spirits",
    price: 3500,
    image: "/beefeater-london-dry-gin-bottle.jpg",
    description: "Classic London dry gin with juniper and citrus notes.",
    sizes: [
      { size: "500ml", price: 1900, available: true },
      { size: "1L", price: 3500, available: true },
      { size: "2L", price: 6600, available: false },
    ],
    rating: 4.5,
    reviewCount: 154,
    reviews: [],
    inStock: true,
  },
  {
    id: "liq016",
    name: "Tanqueray Gin",
    category: "Spirits",
    price: 4000,
    image: "/tanqueray-gin-bottle.jpg",
    description: "Premium London dry gin with bold botanical character.",
    sizes: [
      { size: "500ml", price: 2100, available: true },
      { size: "1L", price: 4000, available: true },
      { size: "2L", price: 7600, available: false },
    ],
    rating: 4.7,
    reviewCount: 201,
    reviews: [],
    inStock: true,
  },
  {
    id: "liq017",
    name: "Hendrick's Gin",
    category: "Spirits",
    price: 5200,
    image: "/hendricks-gin-bottle.jpg",
    description: "Uniquely infused with rose and cucumber.",
    sizes: [
      { size: "500ml", price: 2700, available: true },
      { size: "1L", price: 5200, available: true },
      { size: "2L", price: 9900, available: false },
    ],
    rating: 4.8,
    reviewCount: 234,
    reviews: [],
    inStock: true,
    featured: true,
  },
  {
    id: "liq018",
    name: "Appleton Estate Jamaica Rum",
    category: "Spirits",
    price: 4200,
    image: "/appleton-estate-jamaica-rum-bottle.jpg",
    description: "Rich, full-bodied Jamaican rum with tropical notes.",
    sizes: [
      { size: "500ml", price: 2200, available: true },
      { size: "1L", price: 4200, available: true },
      { size: "2L", price: 8000, available: false },
    ],
    rating: 4.6,
    reviewCount: 178,
    reviews: [],
    inStock: true,
  },
  {
    id: "liq019",
    name: "Heineken Beer",
    category: "Liquor",
    price: 180,
    image: "/heineken-beer-bottle.jpg",
    description: "Premium lager beer with crisp, refreshing taste.",
    sizes: [
      { size: "500ml", price: 180, available: true },
      { size: "1L", price: 350, available: true },
      { size: "2L", price: 680, available: true },
    ],
    rating: 4.3,
    reviewCount: 456,
    reviews: [],
    inStock: true,
    trending: true,
  },
  {
    id: "liq020",
    name: "Guinness Stout",
    category: "Liquor",
    price: 200,
    image: "/guinness-stout-beer-bottle.jpg",
    description: "Rich, creamy Irish stout with distinctive flavor.",
    sizes: [
      { size: "500ml", price: 200, available: true },
      { size: "1L", price: 380, available: true },
      { size: "2L", price: 750, available: true },
    ],
    rating: 4.5,
    reviewCount: 389,
    reviews: [],
    inStock: true,
  },
]

// 10 Infused Jaba Products
const infusedJabaProducts: EcommerceProduct[] = [
  {
    id: "jaba001",
    name: "Jaba Infused - Mango Passion",
    category: "Infused Jaba",
    price: 2500,
    image: "/placeholder.jpg",
    description: "Refreshing mango and passion fruit infused Jaba, perfect for summer evenings.",
    sizes: [
      { size: "500ml", price: 2500, available: true },
      { size: "1L", price: 4800, available: true },
      { size: "2L", price: 9200, available: true },
    ],
    rating: 4.9,
    reviewCount: 156,
    reviews: [
      { id: "jr1", userName: "Maria W.", rating: 5, comment: "Amazing flavor! So refreshing!", date: "2024-01-20", verified: true },
    ],
    inStock: true,
    featured: true,
    trending: true,
  },
  {
    id: "jaba002",
    name: "Jaba Infused - Pineapple Mint",
    category: "Infused Jaba",
    price: 2500,
    image: "/placeholder.jpg",
    description: "Tropical pineapple with cooling mint, a perfect balance of sweet and fresh.",
    sizes: [
      { size: "500ml", price: 2500, available: true },
      { size: "1L", price: 4800, available: true },
      { size: "2L", price: 9200, available: true },
    ],
    rating: 4.8,
    reviewCount: 134,
    reviews: [],
    inStock: true,
    trending: true,
  },
  {
    id: "jaba003",
    name: "Jaba Infused - Strawberry Basil",
    category: "Infused Jaba",
    price: 2500,
    image: "/placeholder.jpg",
    description: "Sweet strawberries paired with aromatic basil for a unique flavor profile.",
    sizes: [
      { size: "500ml", price: 2500, available: true },
      { size: "1L", price: 4800, available: true },
      { size: "2L", price: 9200, available: false },
    ],
    rating: 4.7,
    reviewCount: 98,
    reviews: [],
    inStock: true,
    featured: true,
  },
  {
    id: "jaba004",
    name: "Jaba Infused - Lemon Ginger",
    category: "Infused Jaba",
    price: 2500,
    image: "/placeholder.jpg",
    description: "Zesty lemon with warming ginger, perfect for any occasion.",
    sizes: [
      { size: "500ml", price: 2500, available: true },
      { size: "1L", price: 4800, available: true },
      { size: "2L", price: 9200, available: true },
    ],
    rating: 4.6,
    reviewCount: 112,
    reviews: [],
    inStock: true,
  },
  {
    id: "jaba005",
    name: "Jaba Infused - Watermelon Cucumber",
    category: "Infused Jaba",
    price: 2500,
    image: "/placeholder.jpg",
    description: "Cool and refreshing watermelon with crisp cucumber notes.",
    sizes: [
      { size: "500ml", price: 2500, available: true },
      { size: "1L", price: 4800, available: true },
      { size: "2L", price: 9200, available: true },
    ],
    rating: 4.8,
    reviewCount: 145,
    reviews: [],
    inStock: true,
    trending: true,
  },
  {
    id: "jaba006",
    name: "Jaba Infused - Berry Blast",
    category: "Infused Jaba",
    price: 2500,
    image: "/placeholder.jpg",
    description: "Mixed berries explosion with natural sweetness.",
    sizes: [
      { size: "500ml", price: 2500, available: true },
      { size: "1L", price: 4800, available: true },
      { size: "2L", price: 9200, available: false },
    ],
    rating: 4.7,
    reviewCount: 123,
    reviews: [],
    inStock: true,
  },
  {
    id: "jaba007",
    name: "Jaba Infused - Citrus Burst",
    category: "Infused Jaba",
    price: 2500,
    image: "/placeholder.jpg",
    description: "A vibrant mix of orange, lime, and grapefruit.",
    sizes: [
      { size: "500ml", price: 2500, available: true },
      { size: "1L", price: 4800, available: true },
      { size: "2L", price: 9200, available: true },
    ],
    rating: 4.5,
    reviewCount: 89,
    reviews: [],
    inStock: true,
  },
  {
    id: "jaba008",
    name: "Jaba Infused - Tropical Paradise",
    category: "Infused Jaba",
    price: 2500,
    image: "/placeholder.jpg",
    description: "Exotic blend of coconut, pineapple, and passion fruit.",
    sizes: [
      { size: "500ml", price: 2500, available: true },
      { size: "1L", price: 4800, available: true },
      { size: "2L", price: 9200, available: true },
    ],
    rating: 4.9,
    reviewCount: 167,
    reviews: [],
    inStock: true,
    featured: true,
  },
  {
    id: "jaba009",
    name: "Jaba Infused - Apple Cinnamon",
    category: "Infused Jaba",
    price: 2500,
    image: "/placeholder.jpg",
    description: "Warm apple with spicy cinnamon, perfect for cozy evenings.",
    sizes: [
      { size: "500ml", price: 2500, available: true },
      { size: "1L", price: 4800, available: true },
      { size: "2L", price: 9200, available: false },
    ],
    rating: 4.6,
    reviewCount: 101,
    reviews: [],
    inStock: true,
  },
  {
    id: "jaba010",
    name: "Jaba Infused - Peach Lavender",
    category: "Infused Jaba",
    price: 2500,
    image: "/placeholder.jpg",
    description: "Delicate peach with soothing lavender, elegant and refined.",
    sizes: [
      { size: "500ml", price: 2500, available: true },
      { size: "1L", price: 4800, available: true },
      { size: "2L", price: 9200, available: true },
    ],
    rating: 4.8,
    reviewCount: 134,
    reviews: [],
    inStock: true,
  },
]

export const ecommerceProducts: EcommerceProduct[] = [...liquorProducts, ...infusedJabaProducts]

export const ecommerceCategories: Category[] = [
  {
    id: "infused-jaba",
    name: "Infused Jaba",
    image: "/custom-drink.jpg",
    productCount: 10,
  },
  {
    id: "liquor",
    name: "Liquor",
    image: "/heineken-beer-bottle.jpg",
    productCount: 2,
  },
  {
    id: "spirits",
    name: "Spirits",
    image: "/johnnie-walker-black-label-whiskey-bottle.jpg",
    productCount: 18,
  },
  {
    id: "wines",
    name: "Wines",
    image: "/chivas-regal-12-year-scotch-whiskey.jpg",
    productCount: 0,
  },
  {
    id: "soft-drinks",
    name: "Soft Drinks",
    image: "/corona-extra-beer-bottle.jpg",
    productCount: 0,
  },
]

