import { AdminTemplateSchemaEditor } from "../../content-types/[schemaSlug]/client"

export default async function TemplateComponentEditorPage({
  params,
}: {
  params: Promise<{ id: string, schemaSlug: string }>
}) {
  const { schemaSlug } = await params

  return (
    <AdminTemplateSchemaEditor 
      schemaType="components" 
      schemaSlug={schemaSlug} 
    />
  )
}
