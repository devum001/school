import type { ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import { useSchoolFeature } from '../../app/schoolFeatureContext';
export default function StudentRecordLink(props: ComponentProps<typeof Link>) {
  const feature = useSchoolFeature();
  return feature && !feature.canViewStudentProfiles ? (
    <div className={props.className}>{props.children}</div>
  ) : (
    <Link {...props} />
  );
}
