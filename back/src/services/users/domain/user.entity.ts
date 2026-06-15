import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserStatus = 'active' | 'inactive' | 'withdrawn';

type Ctor = {
    email: string;
    password: string;
    name: string;
    nickname?: string;
    profileImageUrl?: string;
    status?: UserStatus;
};

@Entity('users')
export class User extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true, comment: '사용자 이메일' })
    email!: string;

    @Column({ comment: '사용자 패스워드' })
    password!: string;

    @Column({ comment: '사용자 이름' })
    name!: string;

    @Column({ comment: '사용자 닉네임', nullable: true })
    nickname?: string;

    @Column({ comment: '사용자 프로필 이미지 URL', nullable: true })
    profileImageUrl?: string;

    @Column({ comment: '사용자 상태', default: 'active' })
    status!: UserStatus;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.email = args.email;
            this.password = args.password;
            this.name = args.name;
            this.nickname = args.nickname;
            this.profileImageUrl = args.profileImageUrl;
            this.status = args.status ?? 'active';
        }
    }

    update({
        email,
        name,
        nickname,
        profileImageUrl,
        status,
    }: {
        email?: string;
        name?: string;
        nickname?: string;
        profileImageUrl?: string;
        status?: UserStatus;
    }) {
        const changedArgs = this.stripUnchanged({
            email,
            name,
            nickname,
            profileImageUrl,
            status,
        });

        if (!changedArgs) {
            return;
        }

        Object.assign(this, changedArgs);
    }

    updatePassword({ password }: { password: string }) {
        this.password = password;
    }
}
