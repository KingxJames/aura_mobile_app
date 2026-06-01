import { useEffect, useState } from "react";

export function useClientOnlyValue<T>(serverValue: T, clientValue: T): T {
  const [value, setValue] = useState(serverValue);

  useEffect(() => {
    setValue(clientValue);
  }, [clientValue]);

  return value;
}
