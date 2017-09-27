#!/bin/bash

init(){
	service hostapd stop > /dev/null 2>&1
	service dnsmasq stop > /dev/null 2>&1
	systemctl disable hostapd > /dev/null 2>&1
	systemctl disable dnsmasq > /dev/null 2>&1
}

allow_interface_wlan(){
	DENYWLAN=`sed -n '/^denyinterfaces wlan0/=' /etc/dhcpcd.conf`
	if test "" != "$DENYWLAN"
	then
		sed -i 's/^denyinterfaces wlan0/# denyinterfaces wlan0/' /etc/dhcpcd.conf
	fi
}

rollback_interfaces(){
	if [ -e /etc/network/interfacesBAK ]
	then
		mv /etc/network/interfacesBAK /etc/network/interfaces
	fi
	service networking restart
}

rollback_dnsmasq(){
	if [ -e /etc/dnsmasqBAK.conf ]
	then
		mv /etc/dnsmasqBAK.conf /etc/dnsmasq.conf
	fi
}


ip_forwarding(){	
	IPFORWARDING_COMMENT=`sed -n '/^#[ ]*net\.ipv4\.ip\_forward\=1/=' /etc/sysctl.conf`

	if test "" != "$IPFORWARDING_COMMENT"
	then
		sed -i 's/^net\.ipv4\.ip\_forward\=1/# net\.ipv4\.ip\_forward\=1/' /etc/sysctl.conf
	fi

	echo 0 > /proc/sys/net/ipv4/ip_forward

	comment="digitalairwaysAPRules"

	iptables-save | grep -v "$comment" | iptables-restore

	iptables-save >/etc/iptables/rules.v4
	ip6tables-save >/etc/iptables/rules.v6
}

init
allow_interface_wlan
rollback_interfaces
rollback_dnsmasq
ip_forwarding