import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, User } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useAuthStore, DEMO_PHONE } from '@/shared/store/authStore';

export function RegisterPage() {
  const navigate = useNavigate();
  const phone = useAuthStore((s) => s.phone) ?? DEMO_PHONE;
  const register = useAuthStore((s) => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const canContinue = name.trim().length > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    register(phone, { name: name.trim(), email: email.trim() || undefined });
    navigate('/auth/create-pin');
  }

  return (
    <div className="flex flex-col min-h-dvh py-10">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-h1 text-text">Crea tu cuenta</h1>
        <p className="text-body text-text-muted">Solo necesitamos algunos datos para continuar</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          type="text"
          label="Nombre completo"
          placeholder="Tu nombre completo"
          prefix={<User className="size-5" />}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          type="email"
          label="Correo"
          placeholder="tucorreo@ejemplo.com"
          prefix={<Mail className="size-5" />}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          helperText="Opcional — lo usamos para verificar tu cuenta y notificarte, no para iniciar sesión"
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-body-strong text-text">Número de celular</span>
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 h-12">
            <span className="text-text text-[16px]">{phone}</span>
          </div>
        </div>

        <Button type="submit" size="lg" fullWidth disabled={!canContinue} className="mt-4">
          Continuar
        </Button>
      </form>
    </div>
  );
}
