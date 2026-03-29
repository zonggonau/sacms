export interface FieldDefinition {
  name: string
  slug: string
  type: string
  required: boolean
  relationSlug?: string
  options?: any
}

export interface ContentTypeDefinition {
  name: string
  slug: string
  description?: string
  fields: FieldDefinition[]
}

export interface ComponentDefinition {
  name: string
  slug: string
  category?: string
  fields: FieldDefinition[]
}

export interface StarterKit {
  name: string
  description: string
  contentTypes: ContentTypeDefinition[]
  singleTypes: ContentTypeDefinition[]
  components: ComponentDefinition[]
}

const GLOBAL_COMPONENTS: ComponentDefinition[] = [
  {
    name: "SEO Metadata",
    slug: "seo",
    category: "Shared",
    fields: [
      { name: "Title", slug: "title", type: "text", required: false },
      { name: "Description", slug: "description", type: "textarea", required: false },
      { name: "Keywords", slug: "keywords", type: "text", required: false },
      { name: "OG Image", slug: "ogImage", type: "media", required: false },
    ]
  },
  {
    name: "Button",
    slug: "button",
    category: "Elements",
    fields: [
      { name: "Label", slug: "label", type: "text", required: true },
      { name: "Link", slug: "link", type: "text", required: true },
      { name: "Variant", slug: "variant", type: "select", required: true, options: { choices: ["primary", "secondary", "outline", "ghost"] } },
    ]
  }
]

const SITE_IDENTITY: ContentTypeDefinition = {
  name: "Site Identity",
  slug: "identity",
  description: "Global site identity and metadata",
  fields: [
    { name: "Site Name", slug: "siteName", type: "text", required: true },
    { name: "Site Description", slug: "siteDescription", type: "textarea", required: false },
    { name: "Logo", slug: "logo", type: "media", required: false },
    { name: "Favicon", slug: "favicon", type: "media", required: false },
  ]
}

const SEO_FIELDS: FieldDefinition[] = [
  { name: "SEO Title", slug: "seoTitle", type: "text", required: false },
  { name: "SEO Description", slug: "seoDescription", type: "textarea", required: false },
  { name: "OG Image", slug: "ogImage", type: "media", required: false },
]

export const STARTER_KITS: Record<string, StarterKit> = {
  blog: {
    name: "Blog & News",
    description: "Standard blog structure with posts, categories, and authors.",
    contentTypes: [
      {
        name: "Authors",
        slug: "authors",
        fields: [
          { name: "Name", slug: "name", type: "text", required: true },
          { name: "Avatar", slug: "avatar", type: "media", required: false },
          { name: "Bio", slug: "bio", type: "textarea", required: false },
        ]
      },
      {
        name: "Categories",
        slug: "categories",
        fields: [
          { name: "Name", slug: "name", type: "text", required: true },
          { name: "Slug", slug: "slug", type: "uid", required: true },
        ]
      },
      {
        name: "Posts",
        slug: "posts",
        fields: [
          { name: "Title", slug: "title", type: "text", required: true },
          { name: "Slug", slug: "slug", type: "uid", required: true },
          { name: "Featured Image", slug: "image", type: "media", required: false },
          { name: "Excerpt", slug: "excerpt", type: "textarea", required: true },
          { name: "Content", slug: "content", type: "richText", required: true },
          { name: "Category", slug: "category", type: "relation", relationSlug: "categories", required: true },
          { name: "Author", slug: "author", type: "relation", relationSlug: "authors", required: true },
          { name: "Published Date", slug: "publishedDate", type: "date", required: true },
          ...SEO_FIELDS
        ]
      }
    ],
    singleTypes: [
      SITE_IDENTITY,
      {
        name: "Homepage",
        slug: "homepage",
        fields: [
          { name: "Hero Title", slug: "heroTitle", type: "text", required: true },
          { name: "Hero Description", slug: "heroDescription", type: "textarea", required: true },
          { name: "Featured Post", slug: "featuredPost", type: "relation", relationSlug: "posts", required: false },
          ...SEO_FIELDS
        ]
      }
    ],
    components: GLOBAL_COMPONENTS
  },
  ecommerce: {
    name: "E-commerce",
    description: "Product catalog, categories, and simple ordering structure.",
    contentTypes: [
      {
        name: "Products",
        slug: "products",
        fields: [
          { name: "Name", slug: "name", type: "text", required: true },
          { name: "Slug", slug: "slug", type: "uid", required: true },
          { name: "Price", slug: "price", type: "integer", required: true },
          { name: "Images", slug: "images", type: "media", required: true },
          { name: "Description", slug: "description", type: "richText", required: true },
          { name: "Stock", slug: "stock", type: "integer", required: true },
          { name: "Category", slug: "category", type: "relation", relationSlug: "categories", required: true },
          ...SEO_FIELDS
        ]
      },
      {
        name: "Product Categories",
        slug: "categories",
        fields: [
          { name: "Name", slug: "name", type: "text", required: true },
          { name: "Slug", slug: "slug", type: "uid", required: true },
          { name: "Icon", slug: "icon", type: "media", required: false },
          ...SEO_FIELDS
        ]
      }
    ],
    singleTypes: [
      SITE_IDENTITY,
      {
        name: "Store Config",
        slug: "store-config",
        fields: [
          { name: "Currency", slug: "currency", type: "text", required: true },
          { name: "Support Email", slug: "supportEmail", type: "text", required: true },
          { name: "Enable Reviews", slug: "enableReviews", type: "boolean", required: false },
        ]
      }
    ],
    components: [
      ...GLOBAL_COMPONENTS,
      {
        name: "Product Spec",
        slug: "spec",
        category: "Commerce",
        fields: [
          { name: "Label", slug: "label", type: "text", required: true },
          { name: "Value", slug: "value", type: "text", required: true },
        ]
      }
    ]
  },
  portfolio: {
    name: "Portfolio",
    description: "Showcase your work with projects, services, and testimonials.",
    contentTypes: [
      {
        name: "Projects",
        slug: "projects",
        fields: [
          { name: "Title", slug: "title", type: "text", required: true },
          { name: "Slug", slug: "slug", type: "uid", required: true },
          { name: "Thumbnail", slug: "thumbnail", type: "media", required: true },
          { name: "Gallery", slug: "gallery", type: "media", required: false },
          { name: "Description", slug: "description", type: "richText", required: true },
          { name: "Client", slug: "client", type: "text", required: false },
          { name: "Completion Date", slug: "date", type: "date", required: false },
          ...SEO_FIELDS
        ]
      },
      {
        name: "Services",
        slug: "services",
        fields: [
          { name: "Title", slug: "title", type: "text", required: true },
          { name: "Icon", slug: "icon", type: "media", required: true },
          { name: "Description", slug: "textarea", type: "textarea", required: true },
        ]
      },
      {
        name: "Testimonials",
        slug: "testimonials",
        fields: [
          { name: "Author", slug: "author", type: "text", required: true },
          { name: "Company", slug: "company", type: "text", required: false },
          { name: "Quote", slug: "quote", type: "textarea", required: true },
          { name: "Avatar", slug: "avatar", type: "media", required: false },
        ]
      }
    ],
    singleTypes: [
      SITE_IDENTITY,
      {
        name: "About Me",
        slug: "about-me",
        fields: [
          { name: "Bio", slug: "bio", type: "richText", required: true },
          { name: "CV File", slug: "cv", type: "media", required: false },
          ...SEO_FIELDS
        ]
      }
    ],
    components: GLOBAL_COMPONENTS
  },
  corporate: {
    name: "Corporate / Company Profile",
    description: "Complete structure for professional business websites.",
    contentTypes: [
      {
        name: "Services",
        slug: "services",
        fields: [
          { name: "Title", slug: "title", type: "text", required: true },
          { name: "Description", slug: "description", type: "textarea", required: true },
          { name: "Icon", slug: "icon", type: "media", required: false },
          ...SEO_FIELDS
        ]
      },
      {
        name: "Team Members",
        slug: "team",
        fields: [
          { name: "Name", slug: "name", type: "text", required: true },
          { name: "Position", slug: "position", type: "text", required: true },
          { name: "Photo", slug: "photo", type: "media", required: true },
          { name: "LinkedIn", slug: "linkedin", type: "text", required: false },
        ]
      },
      {
        name: "Case Studies",
        slug: "case-studies",
        fields: [
          { name: "Title", slug: "title", type: "text", required: true },
          { name: "Challenge", slug: "challenge", type: "textarea", required: true },
          { name: "Solution", slug: "solution", type: "textarea", required: true },
          { name: "Result", slug: "result", type: "textarea", required: true },
          ...SEO_FIELDS
        ]
      }
    ],
    singleTypes: [
      SITE_IDENTITY,
      {
        name: "Contact Info",
        slug: "contact",
        fields: [
          { name: "Address", slug: "address", type: "textarea", required: true },
          { name: "Phone", slug: "phone", type: "text", required: true },
          { name: "Email", slug: "email", type: "text", required: true },
          { name: "Google Maps URL", slug: "maps", type: "text", required: false },
        ]
      }
    ],
    components: GLOBAL_COMPONENTS
  }
}
