'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEmergencyContactsByUnit } from '@/hooks/useEmergency';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { exportToCSV } from '@/lib/export';

export const dynamic = 'force-dynamic';

interface Unit {
  id: string;
  unit_number: string;
}

/**
 * Emergency Contacts Management Page.
 * Shows contacts per unit with privacy-aware display.
 * Fulfills AEMRG-01: Admin can manage emergency contacts per resident.
 */
export default function EmergencyContactsPage() {
  const { communityId } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Fetch all units for the dropdown
  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: [...queryKeys.units.list(communityId!).queryKey],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number')
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('unit_number');

      if (error) throw error;
      return data as Unit[];
    },
    enabled: !!communityId,
  });

  // Fetch contacts for selected unit
  const { data: contacts = [], isLoading: contactsLoading } =
    useEmergencyContactsByUnit(selectedUnitId);

  const handleExport = () => {
    if (!contacts.length) return;

    const exportData = contacts.map((c) => ({
      Residente: c.resident_name,
      Contacto: c.contact_name,
      Relacion: c.relationship,
      'Telefono Principal': c.phone_primary,
      'Telefono Secundario': c.phone_secondary || '-',
      Prioridad: c.priority,
      'Contacto Para': c.contact_for.join(', '),
    }));

    const selectedUnit = units.find((u) => u.id === selectedUnitId);
    exportToCSV(
      exportData,
      `contactos-emergencia-${selectedUnit?.unit_number || 'unidad'}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Contactos de Emergencia
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Ver contactos de emergencia por unidad
          </p>
        </div>
        {selectedUnitId && contacts.length > 0 && (
          <button
            onClick={handleExport}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Exportar CSV
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Unit Selector */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Seleccionar Unidad
          </h2>
          {unitsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded bg-gray-100"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {units.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => setSelectedUnitId(unit.id)}
                  className={`w-full rounded-lg border px-4 py-2 text-left text-sm transition-colors ${
                    selectedUnitId === unit.id
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Unidad {unit.unit_number}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Right: Contact Cards */}
        <div className="lg:col-span-2">
          {!selectedUnitId ? (
            <Card>
              <div className="py-12 text-center text-gray-500">
                <p>Seleccione una unidad para ver contactos de emergencia</p>
              </div>
            </Card>
          ) : contactsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-lg bg-gray-100"
                />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <Card>
              <div className="py-12 text-center text-gray-500">
                <p>No hay contactos de emergencia registrados para esta unidad</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact, idx) => (
                <Card key={idx}>
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {contact.contact_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Residente: {contact.resident_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{contact.relationship}</Badge>
                        <Badge variant="neutral">Prioridad {contact.priority}</Badge>
                      </div>
                    </div>

                    {/* Phone Numbers */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">
                          Telefono Principal:
                        </span>
                        <span className="text-sm text-gray-900">
                          {contact.phone_primary}
                        </span>
                      </div>
                      {contact.phone_secondary && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            Telefono Secundario:
                          </span>
                          <span className="text-sm text-gray-900">
                            {contact.phone_secondary}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Contact For */}
                    {contact.contact_for.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Contacto para:
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {contact.contact_for.map((reason, i) => (
                            <Badge key={i} variant="neutral">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
