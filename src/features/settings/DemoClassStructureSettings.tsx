import ClassStructureSettings from './ClassStructureSettings';
import ClassStudents from './ClassStudents';
import { demoClassSource } from './data/demoSettings';
export default function DemoClassStructureSettings() {
  return (
    <ClassStructureSettings
      source={demoClassSource}
      renderStudents={(id) => <ClassStudents key={id} classId={id} />}
    />
  );
}
