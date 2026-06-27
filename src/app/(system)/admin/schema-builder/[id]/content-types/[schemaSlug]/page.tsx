import { AdminTemplateSchemaEditor } from "./client"

export default async function TemplateSchemaEditorPage({
  params,
}: {
  params: Promise<{ id: string, schemaSlug: string }>
}) {
  const { schemaSlug } = await params

  return (
    <AdminTemplateSchemaEditor 
      schemaType="contentTypes" 
      schemaSlug={schemaSlug} 
    />
  )
}
