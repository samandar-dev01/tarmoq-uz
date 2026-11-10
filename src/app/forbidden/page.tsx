import Link from "next/link";

export const metadata = { title: "No access" };

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">You don’t have access to this page</h1>
      <p className="mt-2 text-sm text-slate-600">Your account type doesn’t allow this area.</p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
