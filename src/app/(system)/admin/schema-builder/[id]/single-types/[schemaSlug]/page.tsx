import { AdminTemplateSchemaEditor } from "../../content-types/[schemaSlug]/client"

export default async function TemplateSingleTypeEditorPage({
  params,
}: {
  params: Promise<{ id: string, schemaSlug: string }>
}) {
  const { schemaSlug } = await params

  return (
    <AdminTemplateSchemaEditor 
      schemaType="singleTypes" 
      schemaSlug={schemaSlug} 
    />
  )
}
