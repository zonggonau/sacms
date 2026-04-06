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
  }
]

const SEO_FIELDS: FieldDefinition[] = [
  { name: "SEO Title", slug: "seoTitle", type: "text", required: false },
  { name: "SEO Description", slug: "seoDescription", type: "textarea", required: false },
  { name: "OG Image", slug: "ogImage", type: "media", required: false },
]

export const STARTER_KITS: Record<string, StarterKit> = {
  "sacms-starter": {
    name: "SaCMS Full Kit (Framework Ready)",
    description: "Complete dynamic boilerplate. Optimized for component-based rendering.",
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
          { name: "Subtitle", slug: "subtitle", type: "text", required: false },
          { name: "Content", slug: "content", type: "richText", required: true },
          { name: "Featured Image", slug: "featuredImage", type: "media", required: false },
          { name: "Category", slug: "category", type: "relation", relationSlug: "categories", required: true },
          { name: "Author", slug: "author", type: "relation", relationSlug: "authors", required: true },
          ...SEO_FIELDS
        ]
      }
    ],
    singleTypes: [
      {
        name: "Global Settings",
        slug: "global-settings",
        fields: [
          { name: "Site Name", slug: "siteName", type: "text", required: true },
          { name: "Description", slug: "description", type: "textarea", required: false },
          { name: "Logo", slug: "logo", type: "media", required: false },
          { name: "Favicon", slug: "favicon", type: "media", required: false },
          { name: "Social Links", slug: "socialLinks", type: "component", required: false, options: { componentSlug: "link", repeatable: true } },
        ]
      },
      {
        name: "Navbar",
        slug: "navbar",
        fields: [
          { name: "Brand Name", slug: "brandName", type: "text", required: true },
          { name: "Logo", slug: "logo", type: "media", required: false },
          { name: "Slogan", slug: "slogan", type: "text", required: false },
          { name: "Menu Items", slug: "menuItems", type: "component", required: true, options: { componentSlug: "nav-item-l1", repeatable: true } },
          { name: "CTA Label", slug: "ctaLabel", type: "text", required: false },
          { name: "CTA Link", slug: "ctaLink", type: "text", required: false },
        ]
      },
      {
        name: "Footer",
        slug: "footer",
        fields: [
          { name: "Description", slug: "description", type: "textarea", required: false },
          { name: "Copyright Text", slug: "copyright", type: "text", required: false },
          { name: "Sections", slug: "sections", type: "component", required: false, options: { componentSlug: "footer-section", repeatable: true } },
          { name: "Social Links", slug: "socialLinks", type: "component", required: false, options: { componentSlug: "link", repeatable: true } },
        ]
      },
      {
        name: "Homepage",
        slug: "homepage",
        fields: [
          { 
            name: "Blocks", 
            slug: "blocks", 
            type: "component", 
            required: false, 
            options: { repeatable: true, metadata: { isDynamicZone: true } } 
          },
          ...SEO_FIELDS
        ]
      }
    ],
    components: [
      ...GLOBAL_COMPONENTS,
      {
        name: "Link",
        slug: "link",
        category: "Navigation",
        fields: [
          { name: "Label", slug: "label", type: "text", required: true },
          { name: "URL", slug: "url", type: "text", required: true },
        ]
      },
      {
        name: "Nav Item Level 1",
        slug: "nav-item-l1",
        category: "Navigation",
        fields: [
          { name: "Label", slug: "label", type: "text", required: true },
          { name: "URL", slug: "url", type: "text", required: false },
          { name: "Sub Menu", slug: "children", type: "component", required: false, options: { componentSlug: "nav-item-l2", repeatable: true } },
        ]
      },
      {
        name: "Nav Item Level 2",
        slug: "nav-item-l2",
        category: "Navigation",
        fields: [
          { name: "Label", slug: "label", type: "text", required: true },
          { name: "URL", slug: "url", type: "text", required: false },
          { name: "Sub Menu", slug: "children", type: "component", required: false, options: { componentSlug: "link", repeatable: true } },
        ]
      },
      {
        name: "Footer Section",
        slug: "footer-section",
        category: "Navigation",
        fields: [
          { name: "Title", slug: "title", type: "text", required: true },
          { name: "Links", slug: "links", type: "component", required: true, options: { componentSlug: "link", repeatable: true } },
        ]
      },
      {
        name: "Hero Section",
        slug: "hero",
        category: "Page Sections",
        fields: [
          { name: "Title", slug: "title", type: "text", required: true },
          { name: "Description", slug: "description", type: "textarea", required: true },
          { name: "CTA Label", slug: "ctaLabel", type: "text", required: false },
          { name: "CTA URL", slug: "ctaUrl", type: "text", required: false },
          { name: "Image", slug: "image", type: "media", required: false },
        ]
      },
      {
        name: "Features Grid",
        slug: "features",
        category: "Page Sections",
        fields: [
          { name: "Title", slug: "title", type: "text", required: true },
          { name: "Description", slug: "description", type: "textarea", required: false },
          { name: "Items", slug: "items", type: "component", required: true, options: { componentSlug: "feature-item", repeatable: true } },
        ]
      },
      {
        name: "Feature Item",
        slug: "feature-item",
        category: "UI Elements",
        fields: [
          { name: "Title", slug: "title", type: "text", required: true },
          { name: "Description", slug: "description", type: "textarea", required: true },
          { name: "Icon", slug: "icon", type: "text", required: false },
        ]
      },
      {
        name: "Post List",
        slug: "post-list",
        category: "Page Sections",
        fields: [
          { name: "Title", slug: "title", type: "text", required: true },
          { name: "Limit", slug: "limit", type: "integer", required: false },
        ]
      },
      {
        name: "Rich Text Block",
        slug: "rich-text",
        category: "Page Sections",
        fields: [
          { name: "Content", slug: "content", type: "richText", required: true },
        ]
      }
    ]
  }
}
