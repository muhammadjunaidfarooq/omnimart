import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductsTable } from "@/components/admin/products-table";
import { LookupManager } from "@/components/admin/lookup-manager";

export default function CatalogPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-muted-foreground">Manage products, categories, brands & units.</p>
      </div>
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="pt-4">
          <ProductsTable />
        </TabsContent>
        <TabsContent value="categories" className="pt-4">
          <LookupManager
            resourceLabel="Category"
            resourcePath="categories"
            extraFields={[
              { key: "description", label: "Description", placeholder: "Optional" },
              { key: "hiddenFromPos", label: "Hide from POS", type: "checkbox" },
            ]}
          />
        </TabsContent>
        <TabsContent value="brands" className="pt-4">
          <LookupManager
            resourceLabel="Brand"
            resourcePath="brands"
            extraFields={[{ key: "description", label: "Description", placeholder: "Optional" }]}
          />
        </TabsContent>
        <TabsContent value="units" className="pt-4">
          <LookupManager
            resourceLabel="Unit"
            resourcePath="units"
            extraFields={[{ key: "abbreviation", label: "Abbreviation", placeholder: "e.g. kg" }]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
