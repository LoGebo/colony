'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useCreateElection } from '@/hooks/useGovernance';

interface ElectionFormData {
  title: string;
  description: string;
  election_type: string;
  opens_at: string;
  closes_at: string;
  options: Array<{ title: string; description: string }>;
}

const electionTypes = [
  { value: 'board_election', label: 'Elección de Mesa Directiva' },
  { value: 'extraordinary_expense', label: 'Gasto Extraordinario' },
  { value: 'bylaw_amendment', label: 'Enmienda de Reglamento' },
  { value: 'general_decision', label: 'Decisión General' },
];

export default function NewElectionPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [options, setOptions] = useState<Array<{ title: string; description: string }>>([
    { title: '', description: '' },
    { title: '', description: '' },
  ]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ElectionFormData>({
    defaultValues: {
      election_type: 'general_decision',
    },
  });

  const createElection = useCreateElection();

  const onSubmit = (data: ElectionFormData) => {
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    // Final submission
    const validOptions = options.filter((opt) => opt.title.trim() !== '');
    if (validOptions.length < 2) {
      alert('Debe proporcionar al menos 2 opciones válidas');
      return;
    }

    createElection.mutate(
      {
        title: data.title,
        description: data.description || undefined,
        election_type: data.election_type,
        opens_at: data.opens_at,
        closes_at: data.closes_at,
        options: validOptions,
      },
      {
        onSuccess: () => {
          router.push('/governance/elections');
        },
      }
    );
  };

  const handleAddOption = () => {
    setOptions([...options, { title: '', description: '' }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (
    index: number,
    field: 'title' | 'description',
    value: string
  ) => {
    const newOptions = [...options];
    newOptions[index][field] = value;
    setOptions(newOptions);
  };

  const opensAt = watch('opens_at');
  const closesAt = watch('closes_at');
  const isStep3Valid = opensAt && closesAt && new Date(closesAt) > new Date(opensAt);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Elección</h1>
          <p className="mt-1 text-sm text-gray-500">Paso {currentStep} de 3</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-2">
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`h-2 flex-1 rounded-full ${
              step <= currentStep ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Información Básica
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('title', { required: 'El título es requerido' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Descripción
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tipo de Elección <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('election_type', { required: true })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {electionTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Options */}
        {currentStep === 2 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Opciones</h2>
              <button
                type="button"
                onClick={handleAddOption}
                className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700"
              >
                + Agregar Opción
              </button>
            </div>
            <div className="space-y-4">
              {options.map((option, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Opción {index + 1}
                    </span>
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Título de la opción"
                      value={option.title}
                      onChange={(e) =>
                        handleOptionChange(index, 'title', e.target.value)
                      }
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <textarea
                      placeholder="Descripción (opcional)"
                      value={option.description}
                      onChange={(e) =>
                        handleOptionChange(index, 'description', e.target.value)
                      }
                      rows={2}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Mínimo 2 opciones requeridas
            </p>
          </div>
        )}

        {/* Step 3: Schedule */}
        {currentStep === 3 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Programación
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fecha y Hora de Apertura <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  {...register('opens_at', { required: 'La fecha de apertura es requerida' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.opens_at && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.opens_at.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fecha y Hora de Cierre <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  {...register('closes_at', {
                    required: 'La fecha de cierre es requerida',
                    validate: (value) => {
                      const opens = watch('opens_at');
                      if (opens && new Date(value) <= new Date(opens)) {
                        return 'La fecha de cierre debe ser posterior a la apertura';
                      }
                      return true;
                    },
                  })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.closes_at && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.closes_at.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Anterior
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push('/governance/elections')}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            {currentStep < 3 ? (
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Siguiente
              </button>
            ) : (
              <button
                type="submit"
                disabled={createElection.isPending || !isStep3Valid}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {createElection.isPending ? 'Creando...' : 'Crear Elección'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
