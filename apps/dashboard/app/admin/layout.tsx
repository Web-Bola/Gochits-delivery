import { Guard } from '@/components/Guard';
export default function AdminLayout({ children }: { children: React.ReactNode }) { return <Guard>{children}</Guard>; }
