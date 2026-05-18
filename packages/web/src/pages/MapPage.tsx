import { Link, useParams } from 'react-router-dom';

export default function MapPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <>
      <h1>Canvas</h1>
      <p>Map ID: {id}</p>
      <Link to="/">Voltar</Link>
    </>
  );
}
