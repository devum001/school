# School / Coaching Management App

This product is an internal management workspace for school/coaching staff.
Do not introduce a Student Portal, Parent Portal, student login or guardian login.

Students are managed records: profile, attendance, fees, tests/results, progress,
documents and guardian contact. Guardians are contact recipients for WhatsApp,
SMS, reminders, alerts, notices and shared reports. They are not account users.
In-app notifications belong to the staff workspace, not to guardian records.

School Settings → Roles & Permissions has two sections:

- Roles: Principal / Owner, Admin, Teacher, Accountant, Office Staff and custom staff roles.
- Staff Access: staff member, assigned role, login allowed, and assigned sections where applicable.

Module permissions have only No Access, View and Manage. A Teacher role always
uses assigned classes / sections. Student lists, attendance, academics and
student-related notification recipients must stay within those assignments.
Teacher staff access is limited to their own record. Principal / Owner retains
full management access. Inactive or login-disabled staff have no account access.

The current frontend stores access configuration and provides a scoped preview.
It does not implement sign-in or enforce secure authorization on server data.
Backend integration must authenticate staff, resolve the school and role, enforce
module permissions and assigned-section scope on every query and mutation, and
filter allowed report/notification recipients. Never rely on frontend filtering
as a security boundary.

Student record → Attendance / Fees / Tests / Progress → Management review →
Notification or report → Guardian contact.
