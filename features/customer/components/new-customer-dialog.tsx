'use client';

/**
 * Inline "New customer" popup for the invoice/quotation forms. Captures the
 * essentials plus an optional billing address, creates the customer, and hands
 * the result back so the caller can select them without a page reload.
 */
import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  quickCreateCustomerAction,
  type QuickCustomerResult,
} from '@/features/customer/customer.actions';

export function NewCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: QuickCustomerResult) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [v, setV] = useState({
    customerName: '',
    companyName: '',
    phone: '',
    email: '',
    gstNumber: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
  });

  function set(key: keyof typeof v, value: string) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setV({
      customerName: '',
      companyName: '',
      phone: '',
      email: '',
      gstNumber: '',
      addressLine1: '',
      city: '',
      state: '',
      postalCode: '',
    });
  }

  function submit() {
    if (!v.customerName.trim() || !v.phone.trim()) {
      toast.error('Name and phone are required.');
      return;
    }
    startTransition(async () => {
      const result = await quickCreateCustomerAction({
        customerType: v.companyName.trim() ? 'BUSINESS' : 'INDIVIDUAL',
        customerName: v.customerName,
        companyName: v.companyName || undefined,
        phone: v.phone,
        email: v.email || undefined,
        gstNumber: v.gstNumber || undefined,
        billingAddress: {
          addressLine1: v.addressLine1,
          city: v.city,
          state: v.state,
          postalCode: v.postalCode,
        },
      });
      if (result.success) {
        toast.success(result.message);
        onCreated(result.data);
        reset();
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>
            Add a customer without leaving the invoice. They&apos;ll be selected automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nc-name">
              Customer name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nc-name"
              value={v.customerName}
              onChange={(e) => set('customerName', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-company">Company name</Label>
            <Input
              id="nc-company"
              value={v.companyName}
              onChange={(e) => set('companyName', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-phone">
              Phone <span className="text-destructive">*</span>
            </Label>
            <Input id="nc-phone" value={v.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-email">Email</Label>
            <Input
              id="nc-email"
              type="email"
              value={v.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-gst">GSTIN</Label>
            <Input
              id="nc-gst"
              value={v.gstNumber}
              onChange={(e) => set('gstNumber', e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nc-addr">Address line</Label>
            <Input
              id="nc-addr"
              value={v.addressLine1}
              onChange={(e) => set('addressLine1', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-city">City</Label>
            <Input id="nc-city" value={v.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-state">State</Label>
            <Input id="nc-state" value={v.state} onChange={(e) => set('state', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-pin">Postal code</Label>
            <Input
              id="nc-pin"
              value={v.postalCode}
              onChange={(e) => set('postalCode', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Create & select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
