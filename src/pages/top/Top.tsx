import { useTop } from "./Top.hook";

export const Top = () => {
  const { permissionStatus } = useTop();
  return <div className="text-3xl font-bold">{permissionStatus}</div>;
};
