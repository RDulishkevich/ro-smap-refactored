import { useEffect } from 'react';
import { useUi } from '../state/UiContext';
import { useNav } from '../state/NavContext';

/** Register a leave confirm for create/edit screens; runs on pop / reset / swipe-back. */
export function useLeaveGuard(dirty: boolean, onClear?: () => void) {
  const { confirm } = useUi();
  const { setLeaveGuard } = useNav();

  useEffect(() => {
    if (!dirty) {
      setLeaveGuard(null);
      return () => setLeaveGuard(null);
    }
    setLeaveGuard(async () => {
      const ok = await confirm({
        title: 'Закрыть без сохранения?',
        body: 'Несохранённые изменения пропадут.',
        ok: 'Закрыть',
        destructive: true,
      });
      if (ok) onClear?.();
      return ok;
    });
    return () => setLeaveGuard(null);
  }, [dirty, confirm, setLeaveGuard, onClear]);
}
