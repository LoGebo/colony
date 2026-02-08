'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback, useRef } from 'react';
import { type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  useDocuments,
  useDocumentCategories,
  useCreateDocument,
  useUpdateDocumentVisibility,
  useDeleteDocument,
  DOCUMENT_CATEGORIES,
  type DocumentRow,
} from '@/hooks/useDocuments';
import { formatDate } from '@/lib/formatters';

/* ------------------------------------------------------------------ */
/*  Label / variant maps                                              */
/* ------------------------------------------------------------------ */

const categoryLabel: Record<string, string> = {
  legal: 'Legal',
  assembly: 'Asamblea',
  financial: 'Financiero',
  operational: 'Operativo',
  communication: 'Comunicacion',
};

const categoryVariant: Record<string, 'success' | 'info' | 'warning' | 'neutral' | 'danger'> = {
  legal: 'danger',
  assembly: 'info',
  financial: 'warning',
  operational: 'neutral',
  communication: 'success',
};

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.png';

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [showUploadForm, setShowUploadForm] = useState(false);

  const { data, isLoading } = useDocuments({
    search: debouncedSearch || undefined,
    category: categoryFilter || undefined,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
  });

  const { data: existingCategories } = useDocumentCategories();
  const createDocument = useCreateDocument();
  const updateVisibility = useUpdateDocumentVisibility();
  const deleteDocument = useDeleteDocument();

  // Upload form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('operational');
  const [formDescription, setFormDescription] = useState('');
  const [formPublic, setFormPublic] = useState(true);
  const [formRequiresSignature, setFormRequiresSignature] = useState(false);
  const [formFile, setFormFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormCategory('operational');
    setFormDescription('');
    setFormPublic(true);
    setFormRequiresSignature(false);
    setFormFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleSubmit = useCallback(() => {
    if (!formName || !formFile) return;
    createDocument.mutate(
      {
        name: formName,
        category: formCategory,
        description: formDescription || undefined,
        is_public: formPublic,
        requires_signature: formRequiresSignature,
        file: formFile,
      },
      {
        onSuccess: () => {
          resetForm();
          setShowUploadForm(false);
        },
      }
    );
  }, [formName, formCategory, formDescription, formPublic, formRequiresSignature, formFile, createDocument, resetForm]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (window.confirm(`Eliminar "${name}"? Esta accion es irreversible.`)) {
        deleteDocument.mutate(id);
      }
    },
    [deleteDocument]
  );

  const columns = useMemo<ColumnDef<DocumentRow, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Nombre',
        cell: ({ row }) => (
          <span className="font-medium text-gray-900">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Categoria',
        cell: ({ row }) => {
          const cat = row.original.category;
          return (
            <Badge variant={categoryVariant[cat] ?? 'neutral'}>
              {categoryLabel[cat] ?? cat}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'is_public',
        header: 'Visibilidad',
        cell: ({ row }) => (
          <button
            onClick={() =>
              updateVisibility.mutate({
                docId: row.original.id,
                isPublic: !row.original.is_public,
              })
            }
            className="text-sm"
          >
            <Badge variant={row.original.is_public ? 'success' : 'warning'}>
              {row.original.is_public ? 'Publico' : 'Privado'}
            </Badge>
          </button>
        ),
      },
      {
        accessorKey: 'requires_signature',
        header: 'Firma',
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.requires_signature ? (
              <span className="text-green-600">Requerida</span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'success' : 'neutral'}>
            {row.original.status === 'active' ? 'Activo' : row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'updated_at',
        header: 'Actualizado',
        cell: ({ row }) => formatDate(row.original.updated_at ?? row.original.created_at),
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <button
            onClick={() => handleDelete(row.original.id, row.original.name)}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Eliminar
          </button>
        ),
      },
    ],
    [handleDelete, updateVisibility]
  );

  const pageCount = Math.ceil((data?.count ?? 0) / pagination.pageSize);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          {data?.count != null && (
            <Badge variant="neutral">{data.count}</Badge>
          )}
        </div>
        <Button onClick={() => setShowUploadForm(!showUploadForm)}>
          {showUploadForm ? 'Cancelar' : 'Subir Documento'}
        </Button>
      </div>

      {/* Upload form */}
      {showUploadForm && (
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Subir nuevo documento
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nombre *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nombre del documento"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Categoria
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Descripcion
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                placeholder="Descripcion opcional..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-end gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formPublic}
                  onChange={(e) => setFormPublic(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Publico
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formRequiresSignature}
                  onChange={(e) => setFormRequiresSignature(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Requiere firma
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Archivo *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  resetForm();
                  setShowUploadForm(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formName || !formFile}
                isLoading={createDocument.isPending}
              >
                Subir
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar por nombre..."
          className="w-full max-w-xs rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todas las categorias</option>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        isLoading={isLoading}
      />
    </div>
  );
}
