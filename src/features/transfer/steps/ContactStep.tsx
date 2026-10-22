import { useMemo, useState } from 'react';
import { Search, UserX } from 'lucide-react';
import { useWalletStore } from '@/shared/store/walletStore';
import { useTransferFlowStore } from '../transferStore';
import { Input } from '@/shared/ui/Input';
import { Avatar } from '@/shared/ui/Avatar';
import { EmptyState } from '@/shared/ui/EmptyState';

export function ContactStep() {
  const contacts = useWalletStore((s) => s.contacts);
  const setContact = useTransferFlowStore((s) => s.setContact);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.identifier.toLowerCase().includes(q),
    );
  }, [contacts, query]);

  return (
    <div className="flex flex-col gap-4 px-5 pt-4">
      <Input
        placeholder="Buscar por nombre o teléfono"
        prefix={<Search className="size-5" />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Buscar contacto"
      />

      {filtered.length === 0 ? (
        <EmptyState icon={UserX} title="No encontramos contactos con ese nombre" />
      ) : (
        // No dividers between rows per the Obsidiana y Lima brief —
        // separation is by vertical spacing only.
        <div className="flex flex-col gap-1">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              type="button"
              className="flex items-center gap-3 py-3 text-left min-h-[44px]"
              onClick={() => setContact(contact)}
            >
              <Avatar name={contact.name} />
              <div className="flex-1 min-w-0">
                <p className="text-body-strong text-text truncate">{contact.name}</p>
                <p className="text-caption text-text-muted truncate">{contact.identifier}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
