import { useState, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface CrudItem {
  id: string;
}

interface SettingsCrudProps<T> {
  title: string;
  icon?: React.ElementType;
  items: T[];
  columns: Array<{
    key: keyof T;
    label: string;
    render?: (item: T) => React.ReactNode;
  }>;
  onSave: (item: T) => void;
  onDelete: (id: string) => void;
  renderForm: (
    formData: Partial<T>,
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void,
    setFormData: React.Dispatch<React.SetStateAction<Partial<T>>>
  ) => React.ReactNode;
  initialFormState: Partial<T>;
  disablePagination?: boolean;
  extraContent?: React.ReactNode;
}

export function SettingsCrud<T extends CrudItem>({
  title,
  icon: Icon,
  items,
  columns,
  onSave,
  onDelete,
  renderForm,
  initialFormState,
  disablePagination = false,
  extraContent,
}: SettingsCrudProps<T>) {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<T>>(initialFormState);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  const handleAddNew = () => {
    setFormData(initialFormState);
    setIsAdding(true);
    setEditingId(null);
  };

  const handleEdit = (item: T) => {
    setFormData(item);
    setEditingId(item.id);
    setIsAdding(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Search
  const filteredData = items.filter((item) => { // Changed 'data' to 'items'
    if (!searchQuery) return true;
    return columns.some((col) => {
      const val = item[col.key];
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().includes(searchQuery.toLowerCase());
    });
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, id: editingId || "" } as T);
    setIsAdding(false);
    setEditingId(null);
    toast.success("Data berhasil disimpan");
  };

  return (
    <MainLayout title={title}>
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
             <div className="relative w-full max-w-xs">
                <Input 
                    placeholder="Cari data..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                />
             </div>
             <Button onClick={handleAddNew}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Data
          </Button>
        </div>
        <Button
          variant="ghost"
          onClick={() => navigate("/pengaturan")}
          className="pl-0 hover:bg-transparent hover:text-primary"
        >
          ← Kembali ke Pengaturan
        </Button>

        <Card elevated>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
              )}
              <CardTitle>{title}</CardTitle>
            </div>
            {!isAdding && (
              <Button
                onClick={handleAddNew}
                size="sm"
                variant="glow"
                className="w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Baru
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {/* Extra Content (Filters/Search) rendered here when not adding new item */ }
            {!isAdding && extraContent && (
                <div className="mb-4">
                    {extraContent}
                </div>
            )}

            {isAdding ? (
              <form
                onSubmit={handleSubmit}
                className="space-y-4 animate-slide-up"
              >
                <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                  {renderForm(formData, handleChange, setFormData)}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsAdding(false)}
                    >
                      Batal
                    </Button>
                    <Button type="submit">Simpan</Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Belum ada data.
                  </div>
                ) : (
                  (disablePagination ? items : items.slice(0, displayLimit)).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors animate-slide-up"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {columns[0].render
                            ? columns[0].render(item)
                            : (item[columns[0].key] as React.ReactNode)}
                        </div>
                        {columns.length > 1 && (
                          <div className="text-xs text-muted-foreground">
                            {String(item[columns[1].key])}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                {!disablePagination && items.length > displayLimit && (
                    <Button 
                        variant="ghost" 
                        className="w-full mt-4 border-dashed text-muted-foreground"
                        onClick={() => setDisplayLimit(prev => prev + 10)}
                    >
                        Lihat Lainnya
                    </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
