import { Outlet } from 'react-router-dom';
import ResearchSystemNav from '../../components/research-system/ResearchSystemNav';

export default function ResearchSystemLayout() {
  return (
    <>
      <ResearchSystemNav />
      <Outlet />
    </>
  );
}
