export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form method="post" action="/api/login" className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Expense Tracker</h1>
        <input
          name="password"
          type="password"
          required
          autoFocus
          placeholder="Password"
          className="w-full rounded-lg border border-gray-400 bg-transparent p-3"
        />
        {error && <p className="text-sm text-red-500">Wrong password</p>}
        <button className="w-full rounded-lg bg-emerald-600 p-3 font-semibold text-white">Log in</button>
      </form>
    </main>
  );
}
