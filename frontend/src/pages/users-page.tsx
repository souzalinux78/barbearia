import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { createUser, getUsers, UserRole } from "../services/users.service";

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "ADMIN", label: "Administrador" },
  { value: "BARBER", label: "Barbeiro" },
  { value: "RECEPTION", label: "Recepcao" },
  { value: "UNIT_ADMIN", label: "Gestor Unidade" },
  { value: "UNIT_OWNER", label: "Dono Unidade" },
  { value: "OWNER", label: "Dono" }
];

export const UsersPage = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("BARBER");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setRole("BARBER");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (mutationError) => {
      if (isAxiosError(mutationError) && typeof mutationError.response?.data?.message === "string") {
        setError(mutationError.response.data.message);
        return;
      }
      setError("Nao foi possivel cadastrar usuario. Verifique permissoes e limites do plano.");
    }
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    createMutation.mutate({
      name,
      email,
      phone: phone || undefined,
      password,
      role
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Usuarios e Equipe</h1>
        <p className="text-sm text-slate-400">Cadastre barbeiros, recepcao e administradores.</p>
      </header>

      <Card title="Novo usuario">
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Nome
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            E-mail
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Telefone (opcional)
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Perfil
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400 sm:col-span-2">
            Senha inicial
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          {error ? <p className="text-xs text-rose-300 sm:col-span-2">{error}</p> : null}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-charcoal disabled:opacity-60 sm:col-span-2"
          >
            {createMutation.isPending ? "Salvando..." : "Cadastrar usuario"}
          </button>
        </form>
      </Card>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="space-y-3">
          {data?.map((user) => (
            <Card key={user.id}>
              <p className="font-semibold text-slate-100">{user.name}</p>
              <p className="text-sm text-slate-400">{user.email}</p>
              <p className="text-xs text-slate-500">
                {user.role.name} | {user.phone ?? "Sem telefone"}
              </p>
            </Card>
          ))}
          {!data?.length ? <Card>Nenhum usuario encontrado.</Card> : null}
        </div>
      )}
    </div>
  );
};
