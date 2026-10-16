import { Guard } from '@/components/Guard';
import { BranchProvider } from '@/components/branchctx';
export default function RestaurantLayout({ children }: { children: React.ReactNode }) { return <Guard area="restaurant"><BranchProvider>{children}</BranchProvider></Guard>; }
