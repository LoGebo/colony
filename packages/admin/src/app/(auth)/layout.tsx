export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">UPOE</h1>
          <p className="mt-1 text-sm text-gray-500">
            Panel de Administracion
          </p>
        </div>
        <div className="w-full rounded-xl bg-white p-8 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
