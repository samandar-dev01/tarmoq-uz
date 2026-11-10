import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Create your account</h1>
      <RegisterForm />
    </div>
  );
}
