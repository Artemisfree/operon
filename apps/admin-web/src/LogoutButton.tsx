type Props = {
  onLogout: () => void;
};

export function LogoutButton({ onLogout }: Props) {
  return (
    <button type="button" className="admin-logout-button" onClick={onLogout}>
      Выйти
    </button>
  );
}
