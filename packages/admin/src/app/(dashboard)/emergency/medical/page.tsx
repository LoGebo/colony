'use client';

import { useMedicalConditions, useAccessibilityNeeds } from '@/hooks/useEmergency';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

/**
 * Medical Information & Accessibility Needs Page.
 * Privacy-aware display of medical conditions and accessibility needs.
 * Fulfills AEMRG-02: Admin can view medical conditions and accessibility needs.
 */
export default function MedicalPage() {
  const { data: medicalConditions = [], isLoading: medicalLoading } =
    useMedicalConditions();
  const { data: accessibilityNeeds = [], isLoading: accessibilityLoading } =
    useAccessibilityNeeds();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Informacion Medica y Necesidades de Accesibilidad
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Informacion confidencial para administradores
        </p>
      </div>

      {/* Privacy Banner */}
      <Card className="border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
            <svg
              className="h-5 w-5 text-amber-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-amber-900">
              Informacion medica confidencial
            </h3>
            <p className="mt-1 text-sm text-amber-800">
              Solo visible para administradores. Manejar con discrecion y de
              acuerdo con las politicas de privacidad.
            </p>
          </div>
        </div>
      </Card>

      {/* Section 1: Medical Conditions */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Condiciones Medicas
        </h2>
        {medicalLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : medicalConditions.length === 0 ? (
          <Card>
            <div className="py-8 text-center text-gray-500">
              <p>No hay condiciones medicas registradas</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {medicalConditions.map((condition) => (
              <Card key={condition.id}>
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {condition.residents
                          ? `${condition.residents.first_name} ${condition.residents.paternal_surname}`
                          : 'Residente Desconocido'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {condition.condition_name}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge
                        variant={
                          condition.condition_type === 'chronic_condition'
                            ? 'warning'
                            : condition.condition_type === 'allergy'
                            ? 'danger'
                            : 'info'
                        }
                      >
                        {condition.condition_type}
                      </Badge>
                      {condition.severity && (
                        <Badge
                          variant={
                            condition.severity === 'severe' || condition.severity === 'life_threatening'
                              ? 'danger'
                              : condition.severity === 'moderate'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {condition.severity}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Medications */}
                  {condition.medications && condition.medications.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Medicacion:
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {condition.medications.map((med, i) => (
                          <Badge key={i} variant="info">
                            {med}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {condition.description && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Descripcion:
                      </span>
                      <p className="mt-1 text-sm text-gray-600">{condition.description}</p>
                    </div>
                  )}

                  {/* Share with Security */}
                  {condition.share_with_security && (
                    <div className="rounded-md bg-blue-50 px-3 py-2">
                      <p className="text-xs text-blue-800">
                        Compartido con personal de seguridad
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Accessibility Needs */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Necesidades de Accesibilidad
        </h2>
        {accessibilityLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : accessibilityNeeds.length === 0 ? (
          <Card>
            <div className="py-8 text-center text-gray-500">
              <p>No hay necesidades de accesibilidad registradas</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {accessibilityNeeds.map((need) => (
              <Card key={need.id}>
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {need.residents
                          ? `${need.residents.first_name} ${need.residents.paternal_surname}`
                          : 'Residente Desconocido'}
                      </h3>
                    </div>
                    {need.need_type && (
                      <Badge variant="info">{need.need_type}</Badge>
                    )}
                  </div>

                  {/* Description */}
                  {need.description && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Descripcion:
                      </span>
                      <p className="mt-1 text-sm text-gray-600">{need.description}</p>
                    </div>
                  )}

                  {/* Mobility Device */}
                  {need.uses_mobility_device && need.mobility_device_type && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        Dispositivo de movilidad:
                      </span>
                      <Badge variant="info">{need.mobility_device_type}</Badge>
                    </div>
                  )}

                  {/* Service Animal */}
                  {need.has_service_animal && need.service_animal_type && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        Animal de servicio:
                      </span>
                      <Badge variant="info">{need.service_animal_type}</Badge>
                    </div>
                  )}

                  {/* Evacuation Assistance */}
                  {need.needs_evacuation_assistance && (
                    <div className="rounded-md bg-amber-50 px-3 py-2">
                      <p className="text-sm font-medium text-amber-900">
                        Necesita asistencia de evacuacion
                      </p>
                      {need.evacuation_notes && (
                        <p className="mt-1 text-xs text-amber-800">
                          {need.evacuation_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Accommodations */}
                  {need.accommodations && need.accommodations.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Acomodaciones:
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {need.accommodations.map((acc, i) => (
                          <Badge key={i} variant="neutral">
                            {acc}
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
  );
}
