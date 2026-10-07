import { SignIn } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <SignIn />
    </main>
  );
}